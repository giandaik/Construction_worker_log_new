Record consent to electronic records, and stop treating a drawn bitmap as the only legal signature.

Evidence
- 49 CFR 390.32(d) — the framework the eDVIR rule (91 FR 7896, Feb 2026) rests on — refuses electronic records unless they include **proof of consent** to electronic records, and are capable of being retained and accurately reproduced for any party entitled to access.
- eIDAS Art. 25: only a qualified electronic signature (QES) carries legal effect equivalent to a handwritten signature. Greek ΕΣΥ for public works increasingly require the ημερολόγιο to be signed digitally.
- The app stores one thing: `Signature.data`, a base64 PNG (`types/shared.d.ts:40`). No identity credential, no provider, no consent.

Work
1. Consent capture at first use per user (and per tenant, if the customer's policy requires it): a versioned consent record `{ userId, tenantId, version, acceptedAt, textHash, ip, userAgent }`, shown once and retrievable from the user's settings.
2. Make the signature representable beyond a bitmap. Introduce a union on the stored signature:
   `{ kind: 'drawn' | 'qes', data?, provider?, certificateSubject?, signedAt (server), verificationUrl?, level? }`
   so a QES signing can be added for customers whose επίβλεψη requires it, without migrating the drawn ones.
3. Keep the drawn signature as the default (it is what a site handset can produce) but mark the record with its signature *level*, and show that level on the PDF: an engineer must be able to tell what kind of signature they are looking at.
4. Bind each signature to the content it covers: store a content hash of the log at signing time on the signature, so a later edit cannot silently invalidate or repurpose it. Verification = recompute and compare.
5. Do not implement a QES provider in this task — define the interface and the storage shape, and keep provider selection a per-tenant setting. Implementation is a separate, customer-driven task.
6. Review the copy on the landing page and in the FAQ against what is actually true today: if the app does drawn signatures only, the product must not imply handwritten-equivalent legal effect.

Acceptance
- Every signature records its level, its server timestamp, and the content hash it covered.
- A user's consent to electronic records is captured once and retrievable.
- The PDF states the signature level per signer.
- No user-facing claim exceeds what the stored evidence supports.
