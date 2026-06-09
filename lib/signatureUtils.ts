import type { Signature } from '@/types/shared';

const normalizeText = (value?: string): string => {
  return value?.trim().toLowerCase() || '';
};

export const getSignatureRoleType = (
  signature: Signature,
  projectOwnerName?: string,
  projectContractorName?: string
): 'owner' | 'contractor' | undefined => {
  const normalizedRole = normalizeText(signature.role);
  const normalizedName = normalizeText(signature.signedBy);
  const normalizedOwner = normalizeText(projectOwnerName);
  const normalizedContractor = normalizeText(projectContractorName);

  if (normalizedRole.includes('contractor') || (normalizedContractor && normalizedName === normalizedContractor)) {
    return 'contractor';
  }

  if (normalizedRole.includes('owner') || (normalizedOwner && normalizedName === normalizedOwner)) {
    return 'owner';
  }

  return undefined;
};

export const hasContractorThenOwnerSignatures = (
  signatures: Signature[],
  projectOwnerName?: string,
  projectContractorName?: string
): boolean => {
  const contractorIndex = signatures.findIndex((signature) =>
    getSignatureRoleType(signature, projectOwnerName, projectContractorName) === 'contractor'
  );
  const ownerIndex = signatures.findIndex((signature) =>
    getSignatureRoleType(signature, projectOwnerName, projectContractorName) === 'owner'
  );

  return contractorIndex !== -1 && ownerIndex !== -1 && contractorIndex < ownerIndex;
};

export const getWorkLogStatusFromSignatures = (
  signatures: Signature[],
  projectOwnerName?: string,
  projectContractorName?: string
): string => {
  if (hasContractorThenOwnerSignatures(signatures, projectOwnerName, projectContractorName)) {
    return 'completed';
  }

  return signatures.length > 0 ? 'signed' : 'pending';
};

export const validateSignatureOrder = (
  signatures: Signature[],
  projectOwnerName?: string,
  projectContractorName?: string
): string | null => {
  // Disallow more than two signatures
  if (signatures.length > 2) {
    return 'A work log can have at most two signatures.';
  }

  // Disallow duplicate signers
  const signerNames = signatures.map((s) => normalizeText(s.signedBy));
  const duplicate = signerNames.some((name, idx) => name && signerNames.indexOf(name) !== idx);
  if (duplicate) {
    return 'The same person cannot sign the work log more than once.';
  }
  const contractSigned = signatures.some((signature) =>
    getSignatureRoleType(signature, projectOwnerName, projectContractorName) === 'contractor'
  );
  const ownerIndex = signatures.findIndex((signature) =>
    getSignatureRoleType(signature, projectOwnerName, projectContractorName) === 'owner'
  );

  if (ownerIndex === -1) {
    return null;
  }

  if (!contractSigned) {
    return 'The project owner cannot sign until the contractor has signed.';
  }

  const firstContractorIndex = signatures.findIndex((signature) =>
    getSignatureRoleType(signature, projectOwnerName, projectContractorName) === 'contractor'
  );

  if (firstContractorIndex > ownerIndex) {
    return 'The project owner must sign after the contractor.';
  }

  return null;
};

export const getSignatureAddError = (
  newSignature: Signature,
  signatures: Signature[],
  projectOwnerName?: string,
  projectContractorName?: string
): string | null => {
  // Prevent adding if already two signatures
  if (signatures.length >= 2) {
    return 'A work log can have at most two signatures.';
  }

  // Prevent same user signing twice
  const newName = normalizeText(newSignature.signedBy);
  if (newName && signatures.some((s) => normalizeText(s.signedBy) === newName)) {
    return 'This user has already signed the work log.';
  }

  const newSignatureType = getSignatureRoleType(newSignature, projectOwnerName, projectContractorName);

  if (newSignatureType !== 'owner') {
    return null;
  }

  const hasContractorSignature = signatures.some((signature) =>
    getSignatureRoleType(signature, projectOwnerName, projectContractorName) === 'contractor'
  );

  if (!hasContractorSignature) {
    return 'The project owner cannot sign until the contractor has signed.';
  }

  return null;
};
