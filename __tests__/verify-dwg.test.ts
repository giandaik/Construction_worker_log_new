import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Project from '../lib/models/Project';
import WorkLog from '../lib/models/WorkLog';
import User from '../lib/models/User';
import { projectSchema, dwgFileSchema } from '../lib/schemas/projectSchema';
import { workLogSchema } from '../lib/schemas/workLogSchema';

vi.mock('@vercel/blob', () => ({
  put: vi.fn(async (pathname: string) => ({
    url: `https://fake-blob-store.test/${pathname}`,
    pathname,
  })),
  del: vi.fn(async () => undefined),
}));

vi.mock('@/utils/auth', () => ({
  getAuthUser: vi.fn(),
  isAdmin: (u: any) => u?.role === 'admin' || u?.role === 'manager',
}));

// Required because the route reads process.env at module load time
process.env.BLOB_READ_WRITE_TOKEN = 'fake-token';

import { POST as uploadDwg } from '../app/api/upload/dwg/route';
import { POST as uploadPdf } from '../app/api/upload/pdf/route';
import {
  POST as attachDwg,
  DELETE as removeDwg,
} from '../app/api/projects/[id]/dwgs/route';
import { getAuthUser } from '@/utils/auth';
import { del as blobDel } from '@vercel/blob';

const mockedGetAuthUser = vi.mocked(getAuthUser);

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

function makeRequest(parts: Record<string, string | Blob>): Request {
  const form = new FormData();
  for (const [k, v] of Object.entries(parts)) {
    form.append(k, v as any);
  }
  // formData() on a Request built from FormData hangs in the Node test env,
  // so we stub it to return the FormData directly. The route only calls .formData().
  return { formData: async () => form } as unknown as Request;
}

describe('Task 1 — Data model: Project.dwgFiles + WorkLog.dwgRefs', () => {
  it('Project saves and reads back dwgFiles', async () => {
    const owner = await User.create({ name: 'Owner', email: 'owner@test', role: 'manager', password: 'x' });
    const contractor = await User.create({ name: 'C', email: 'c@test', role: 'user', password: 'x' });
    const manager = await User.create({ name: 'M', email: 'm@test', role: 'manager', password: 'x' });

    const project = await Project.create({
      name: 'P1',
      description: 'd',
      location: 'L',
      startDate: new Date(),
      ownerEmail: 'owner@test',
      contractorEmail: 'c@test',
      ownerUserId: owner._id,
      contractorUserId: contractor._id,
      manager: manager._id,
      dwgFiles: [
        {
          url: 'https://blob/projects/x/dwgs/1.dwg',
          filename: 'plan-a.dwg',
          size: 1234,
          uploadedBy: owner._id,
        },
      ],
    });

    const fresh = await Project.findById(project._id).lean<any>();
    expect(fresh?.dwgFiles).toHaveLength(1);
    expect(fresh?.dwgFiles[0].filename).toBe('plan-a.dwg');
    expect(fresh?.dwgFiles[0].size).toBe(1234);
    expect(fresh?.dwgFiles[0].uploadedAt).toBeInstanceOf(Date);
  });

  it('Project without dwgFiles defaults to empty array (backward compat)', async () => {
    const u = await User.create({ name: 'U', email: 'u2@test', role: 'manager', password: 'x' });
    const project = await Project.create({
      name: 'P2',
      description: 'd',
      location: 'L',
      startDate: new Date(),
      ownerEmail: 'a@test',
      contractorEmail: 'b@test',
      ownerUserId: u._id,
      contractorUserId: u._id,
      manager: u._id,
    });
    const fresh = await Project.findById(project._id).lean<any>();
    expect(fresh?.dwgFiles).toEqual([]);
  });

  it('WorkLog saves and reads back dwgRefs', async () => {
    const u = await User.create({ name: 'WL', email: 'wl@test', role: 'user', password: 'x' });
    const p = new Types.ObjectId();
    const wl = await WorkLog.create({
      date: new Date(),
      project: p,
      author: u._id,
      workDescription: 'work',
      dwgRefs: ['https://blob/a.dwg', 'https://blob/b.dwg'],
    });
    const fresh = await WorkLog.findById(wl._id).lean<any>();
    expect(fresh?.dwgRefs).toEqual(['https://blob/a.dwg', 'https://blob/b.dwg']);
  });

  it('Zod schemas accept dwgFiles + dwgRefs', () => {
    expect(
      projectSchema.safeParse({
        name: 'P',
        ownerEmail: 'a@b.co',
        contractorEmail: 'c@d.co',
        dwgFiles: [{ url: 'https://x/a.dwg', filename: 'a.dwg', size: 1 }],
      }).success,
    ).toBe(true);

    expect(
      workLogSchema.safeParse({
        date: '2026-06-11',
        project: 'pid',
        author: 'aid',
        workDescription: 'w',
        dwgRefs: ['https://x/a.dwg'],
      }).success,
    ).toBe(true);

    expect(dwgFileSchema.safeParse({ url: 'not-a-url', filename: 'a.dwg', size: 1 }).success).toBe(false);
  });

  it('dwgFileSchema accepts optional PDF companion fields', () => {
    expect(
      dwgFileSchema.safeParse({
        url: 'https://x/a.dwg',
        filename: 'a.dwg',
        size: 10,
        pdfUrl: 'https://x/a.pdf',
        pdfFilename: 'a.pdf',
        pdfSize: 20,
      }).success,
    ).toBe(true);

    expect(
      dwgFileSchema.safeParse({
        url: 'https://x/a.dwg',
        filename: 'a.dwg',
        size: 10,
        pdfUrl: 'not-a-url',
      }).success,
    ).toBe(false);
  });

  it('Project persists optional PDF companion fields on dwgFiles', async () => {
    const u = await User.create({ name: 'PD', email: 'pd@test', role: 'manager', password: 'x' });
    const project = await Project.create({
      name: 'P-PDF',
      description: 'd',
      location: 'L',
      startDate: new Date(),
      ownerEmail: 'a@test',
      contractorEmail: 'b@test',
      ownerUserId: u._id,
      contractorUserId: u._id,
      manager: u._id,
      dwgFiles: [
        {
          url: 'https://blob/x.dwg',
          filename: 'x.dwg',
          size: 100,
          pdfUrl: 'https://blob/x.pdf',
          pdfFilename: 'x.pdf',
          pdfSize: 200,
          uploadedBy: u._id,
        },
      ],
    });
    const fresh = await Project.findById(project._id).lean<any>();
    expect(fresh?.dwgFiles[0].pdfUrl).toBe('https://blob/x.pdf');
    expect(fresh?.dwgFiles[0].pdfFilename).toBe('x.pdf');
    expect(fresh?.dwgFiles[0].pdfSize).toBe(200);
  });
});

describe('Task 4 — POST /api/upload/pdf validation', () => {
  it('returns 401 when unauthenticated', async () => {
    mockedGetAuthUser.mockResolvedValueOnce(null);
    const res = await uploadPdf(makeRequest({ file: new Blob(['x']), projectId: 'irrelevant' }));
    expect(res.status).toBe(401);
  });

  it('returns 403 when authenticated as worker (role=user)', async () => {
    mockedGetAuthUser.mockResolvedValueOnce({ userId: 'u', name: 'n', role: 'user' });
    const res = await uploadPdf(makeRequest({ file: new Blob(['x']), projectId: 'irrelevant' }));
    expect(res.status).toBe(403);
  });

  it('returns 400 when file is not .pdf', async () => {
    mockedGetAuthUser.mockResolvedValueOnce({ userId: 'u', name: 'n', role: 'admin' });
    const file = new File(['hello'], 'plan.png', { type: 'image/png' });
    const res = await uploadPdf(
      makeRequest({ file, projectId: new Types.ObjectId().toString() }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/\.pdf/);
  });

  it('returns 400 when file exceeds 25MB', async () => {
    mockedGetAuthUser.mockResolvedValueOnce({ userId: 'u', name: 'n', role: 'manager' });
    const big = new Blob([new Uint8Array(26 * 1024 * 1024)]);
    const file = new File([big], 'big.pdf', { type: 'application/pdf' });
    const res = await uploadPdf(
      makeRequest({ file, projectId: new Types.ObjectId().toString() }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 200 with url/pathname/filename/size on happy path', async () => {
    mockedGetAuthUser.mockResolvedValueOnce({ userId: 'u', name: 'n', role: 'manager' });
    const projectId = new Types.ObjectId().toString();
    const file = new File(['%PDF-bytes'], 'site-plan.pdf', { type: 'application/pdf' });
    const res = await uploadPdf(makeRequest({ file, projectId }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.filename).toBe('site-plan.pdf');
    expect(body.url).toContain(`projects/${projectId}/pdfs/`);
    expect(body.pathname).toMatch(/^projects\/.+\/pdfs\/\d+-[a-f0-9-]+\.pdf$/);
  });
});

describe('Task 5 — attach route accepts optional PDF fields', () => {
  it('POST happy path persists pdfUrl/pdfFilename/pdfSize', async () => {
    const projectId = await makeProject();
    const userId = new Types.ObjectId().toString();
    mockedGetAuthUser.mockResolvedValueOnce({ userId, name: 'n', role: 'manager' });

    const res = await attachDwg(
      jsonRequest({
        url: 'https://fake-blob-store.test/projects/x/dwgs/with-pdf.dwg',
        pathname: 'projects/x/dwgs/with-pdf.dwg',
        filename: 'site.dwg',
        size: 1000,
        pdfUrl: 'https://fake-blob-store.test/projects/x/pdfs/with-pdf.pdf',
        pdfFilename: 'site.pdf',
        pdfSize: 2000,
      }),
      { params: Promise.resolve({ id: projectId }) },
    );
    expect(res.status).toBe(200);

    const fresh = await Project.findById(projectId).lean<any>();
    expect(fresh?.dwgFiles).toHaveLength(1);
    expect(fresh?.dwgFiles[0].pdfUrl).toBe('https://fake-blob-store.test/projects/x/pdfs/with-pdf.pdf');
    expect(fresh?.dwgFiles[0].pdfFilename).toBe('site.pdf');
    expect(fresh?.dwgFiles[0].pdfSize).toBe(2000);
  });

  it('POST returns 400 when pdfUrl is not a valid URL', async () => {
    mockedGetAuthUser.mockResolvedValueOnce({ userId: 'u', name: 'n', role: 'admin' });
    const res = await attachDwg(
      jsonRequest({
        url: 'https://x/a.dwg',
        pathname: 'p',
        filename: 'a.dwg',
        size: 1,
        pdfUrl: 'not-a-url',
        pdfFilename: 'a.pdf',
        pdfSize: 1,
      }),
      { params: Promise.resolve({ id: new Types.ObjectId().toString() }) },
    );
    expect(res.status).toBe(400);
  });

  it('DELETE also removes the PDF blob when present', async () => {
    const projectId = await makeProject();
    const dwgUrl = 'https://fake-blob-store.test/projects/d/dwgs/del.dwg';
    const pdfUrl = 'https://fake-blob-store.test/projects/d/pdfs/del.pdf';
    const userId = new Types.ObjectId();

    await Project.findByIdAndUpdate(projectId, {
      $push: {
        dwgFiles: {
          url: dwgUrl,
          filename: 'del.dwg',
          size: 1,
          pdfUrl,
          pdfFilename: 'del.pdf',
          pdfSize: 2,
          uploadedBy: userId,
        },
      },
    });

    vi.mocked(blobDel).mockClear();
    mockedGetAuthUser.mockResolvedValueOnce({ userId: userId.toString(), name: 'n', role: 'admin' });
    const res = await removeDwg(
      jsonRequest({ url: dwgUrl }),
      { params: Promise.resolve({ id: projectId }) },
    );
    expect(res.status).toBe(200);

    expect(blobDel).toHaveBeenCalledWith(dwgUrl);
    expect(blobDel).toHaveBeenCalledWith(pdfUrl);
  });
});

describe('Task 2 — POST /api/upload/dwg validation', () => {
  it('returns 401 when unauthenticated', async () => {
    mockedGetAuthUser.mockResolvedValueOnce(null);
    const res = await uploadDwg(makeRequest({ file: new Blob(['x']), projectId: 'irrelevant' }));
    expect(res.status).toBe(401);
  });

  it('returns 403 when authenticated as worker (role=user)', async () => {
    mockedGetAuthUser.mockResolvedValueOnce({ userId: 'u', name: 'n', role: 'user' });
    const res = await uploadDwg(makeRequest({ file: new Blob(['x']), projectId: 'irrelevant' }));
    expect(res.status).toBe(403);
  });

  it('returns 400 when projectId missing', async () => {
    mockedGetAuthUser.mockResolvedValueOnce({ userId: 'u', name: 'n', role: 'admin' });
    const file = new File(['hello'], 'plan.dwg', { type: 'application/acad' });
    const res = await uploadDwg(makeRequest({ file }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when file is not .dwg', async () => {
    mockedGetAuthUser.mockResolvedValueOnce({ userId: 'u', name: 'n', role: 'admin' });
    const file = new File(['hello'], 'plan.png', { type: 'image/png' });
    const res = await uploadDwg(
      makeRequest({ file, projectId: new Types.ObjectId().toString() }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/\.dwg/);
  });

  it('returns 400 when file exceeds 25MB', async () => {
    mockedGetAuthUser.mockResolvedValueOnce({ userId: 'u', name: 'n', role: 'manager' });
    const big = new Blob([new Uint8Array(26 * 1024 * 1024)]);
    const file = new File([big], 'big.dwg', { type: 'application/acad' });
    const res = await uploadDwg(
      makeRequest({ file, projectId: new Types.ObjectId().toString() }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 200 with url/pathname/filename/size on happy path (manager + .dwg + valid projectId)', async () => {
    mockedGetAuthUser.mockResolvedValueOnce({ userId: 'u', name: 'n', role: 'manager' });
    const projectId = new Types.ObjectId().toString();
    const file = new File(['CAD-bytes'], 'site-plan.dwg', { type: 'application/acad' });
    const res = await uploadDwg(makeRequest({ file, projectId }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.filename).toBe('site-plan.dwg');
    expect(body.size).toBe(9);
    expect(body.url).toContain(`projects/${projectId}/dwgs/`);
    expect(body.pathname).toMatch(/^projects\/.+\/dwgs\/\d+-[a-f0-9-]+\.dwg$/);
  });
});

async function makeProject(): Promise<string> {
  const u = await User.create({
    name: 'PM',
    email: `pm-${Date.now()}-${Math.random()}@test`,
    role: 'manager',
    password: 'x',
  });
  const project = await Project.create({
    name: 'P',
    description: 'd',
    location: 'L',
    startDate: new Date(),
    ownerEmail: 'a@test',
    contractorEmail: 'b@test',
    ownerUserId: u._id,
    contractorUserId: u._id,
    manager: u._id,
  });
  return (project._id as Types.ObjectId).toString();
}

function jsonRequest(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}

describe('Task 3 — POST/DELETE /api/projects/[id]/dwgs', () => {
  it('POST returns 401 when unauthenticated', async () => {
    mockedGetAuthUser.mockResolvedValueOnce(null);
    const res = await attachDwg(
      jsonRequest({ url: 'https://x/a.dwg', pathname: 'p', filename: 'a.dwg', size: 1 }),
      { params: Promise.resolve({ id: new Types.ObjectId().toString() }) },
    );
    expect(res.status).toBe(401);
  });

  it('POST returns 403 when role=user', async () => {
    mockedGetAuthUser.mockResolvedValueOnce({ userId: 'u', name: 'n', role: 'user' });
    const res = await attachDwg(
      jsonRequest({ url: 'https://x/a.dwg', pathname: 'p', filename: 'a.dwg', size: 1 }),
      { params: Promise.resolve({ id: new Types.ObjectId().toString() }) },
    );
    expect(res.status).toBe(403);
  });

  it('POST returns 400 for malformed body', async () => {
    mockedGetAuthUser.mockResolvedValueOnce({ userId: 'u', name: 'n', role: 'admin' });
    const res = await attachDwg(
      jsonRequest({ url: 'not-a-url', filename: 'a.dwg', size: -1 }),
      { params: Promise.resolve({ id: new Types.ObjectId().toString() }) },
    );
    expect(res.status).toBe(400);
  });

  it('POST returns 404 for unknown project', async () => {
    mockedGetAuthUser.mockResolvedValueOnce({
      userId: new Types.ObjectId().toString(),
      name: 'n',
      role: 'admin',
    });
    const res = await attachDwg(
      jsonRequest({ url: 'https://x/a.dwg', pathname: 'p', filename: 'a.dwg', size: 1 }),
      { params: Promise.resolve({ id: new Types.ObjectId().toString() }) },
    );
    expect(res.status).toBe(404);
  });

  it('POST happy path: appends DWG to project.dwgFiles', async () => {
    const projectId = await makeProject();
    const userId = new Types.ObjectId().toString();
    mockedGetAuthUser.mockResolvedValueOnce({ userId, name: 'n', role: 'manager' });

    const res = await attachDwg(
      jsonRequest({
        url: 'https://fake-blob-store.test/projects/x/dwgs/1.dwg',
        pathname: 'projects/x/dwgs/1.dwg',
        filename: 'site.dwg',
        size: 4242,
      }),
      { params: Promise.resolve({ id: projectId }) },
    );
    expect(res.status).toBe(200);

    const fresh = await Project.findById(projectId).lean<any>();
    expect(fresh?.dwgFiles).toHaveLength(1);
    expect(fresh?.dwgFiles[0].filename).toBe('site.dwg');
    expect(fresh?.dwgFiles[0].size).toBe(4242);
    expect(fresh?.dwgFiles[0].uploadedBy?.toString()).toBe(userId);
    expect(fresh?.dwgFiles[0].uploadedAt).toBeInstanceOf(Date);
  });

  it('DELETE happy path: removes the entry by url and calls blob del()', async () => {
    const projectId = await makeProject();
    const keepUrl = 'https://fake-blob-store.test/projects/y/dwgs/keep.dwg';
    const dropUrl = 'https://fake-blob-store.test/projects/y/dwgs/drop.dwg';

    const userId = new Types.ObjectId();
    await Project.findByIdAndUpdate(projectId, {
      $push: {
        dwgFiles: {
          $each: [
            { url: keepUrl, pathname: 'p1', filename: 'keep.dwg', size: 1, uploadedBy: userId },
            { url: dropUrl, pathname: 'p2', filename: 'drop.dwg', size: 2, uploadedBy: userId },
          ],
        },
      },
    });

    mockedGetAuthUser.mockResolvedValueOnce({ userId: userId.toString(), name: 'n', role: 'admin' });
    const res = await removeDwg(
      jsonRequest({ url: dropUrl }),
      { params: Promise.resolve({ id: projectId }) },
    );
    expect(res.status).toBe(200);

    const fresh = await Project.findById(projectId).lean<any>();
    expect(fresh?.dwgFiles).toHaveLength(1);
    expect(fresh?.dwgFiles[0].url).toBe(keepUrl);

    expect(blobDel).toHaveBeenCalledWith(dropUrl);
  });

  it('DELETE returns 401 unauth, 403 worker', async () => {
    mockedGetAuthUser.mockResolvedValueOnce(null);
    let res = await removeDwg(
      jsonRequest({ url: 'https://x/a.dwg' }),
      { params: Promise.resolve({ id: new Types.ObjectId().toString() }) },
    );
    expect(res.status).toBe(401);

    mockedGetAuthUser.mockResolvedValueOnce({ userId: 'u', name: 'n', role: 'user' });
    res = await removeDwg(
      jsonRequest({ url: 'https://x/a.dwg' }),
      { params: Promise.resolve({ id: new Types.ObjectId().toString() }) },
    );
    expect(res.status).toBe(403);
  });
});
