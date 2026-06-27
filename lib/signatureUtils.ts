import type { Signature } from '@/types/shared';
import { FORM_STATUS } from '@/lib/constants/constantValues';

const normalizeText = (value?: string): string => {
  return value?.trim().toLowerCase() || '';
};

const normalizeSignatureForCompare = (signature: Signature) => ({
  data: signature.data,
  signedBy: signature.signedBy,
  signedAt: new Date(signature.signedAt).toISOString(),
  projectRole: signature.projectRole,
  signedByUserId: signature.signedByUserId?.toString(),
});

export const getSignatureRoleType = (
  signature: Signature,
  projectOwnerName?: string,
  projectContractorName?: string
): 'owner' | 'contractor' | undefined => {
  const normalizedRole = normalizeText(signature.projectRole);
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
    return FORM_STATUS.COMPLETED;
  }

  return signatures.length > 0 ? FORM_STATUS.SIGNED : FORM_STATUS.PENDING;
};

export const isWorkLogCompletedBySignatures = (
  signatures: Signature[],
  projectOwnerName?: string,
  projectContractorName?: string
): boolean => {
  return hasContractorThenOwnerSignatures(signatures, projectOwnerName, projectContractorName);
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
  if (hasContractorThenOwnerSignatures(signatures, projectOwnerName, projectContractorName)) {
    return 'This work log is completed and locked.';
  }

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

  if (newSignatureType === 'contractor') {
    if (signatures.length > 0) {
      return 'The contractor can only sign while the work log is in draft.';
    }

    return null;
  }

  if (newSignatureType !== 'owner') {
    return 'Only the project contractor or owner can sign this work log.';
  }

  const hasContractorSignature = signatures.some((signature) =>
    getSignatureRoleType(signature, projectOwnerName, projectContractorName) === 'contractor'
  );

  if (!hasContractorSignature) {
    return 'The project owner cannot sign until the contractor has signed.';
  }

  return null;
};

export const validateSignatureWorkflowChange = (
  existingSignatures: Signature[],
  updatedSignatures: Signature[],
  projectOwnerName?: string,
  projectContractorName?: string
): string | null => {
  if (isWorkLogCompletedBySignatures(existingSignatures, projectOwnerName, projectContractorName)) {
    return 'This work log is completed and locked.';
  }

  if (updatedSignatures.length < existingSignatures.length) {
    return 'Signatures cannot be removed after the work log is awaiting owner signature.';
  }

  if (updatedSignatures.length === existingSignatures.length) {
    if (
      existingSignatures.length > 0 &&
      JSON.stringify(existingSignatures.map(normalizeSignatureForCompare)) !==
        JSON.stringify(updatedSignatures.map(normalizeSignatureForCompare))
    ) {
      return 'Signatures cannot be changed after the work log is awaiting owner signature.';
    }

    return validateSignatureOrder(updatedSignatures, projectOwnerName, projectContractorName);
  }

  if (updatedSignatures.length !== existingSignatures.length + 1) {
    return 'Only one signature can be added at a time.';
  }

  const addedSignature = updatedSignatures[updatedSignatures.length - 1];
  const addError = getSignatureAddError(
    addedSignature,
    existingSignatures,
    projectOwnerName,
    projectContractorName
  );

  if (addError) {
    return addError;
  }

  return validateSignatureOrder(updatedSignatures, projectOwnerName, projectContractorName);
};

export const validateOwnerRejection = (
  existingSignatures: Signature[],
  workLogStatus: string,
  projectOwnerName?: string,
  projectContractorName?: string
): string | null => {
  if (workLogStatus === FORM_STATUS.COMPLETED) {
    return 'This work log is completed and locked.';
  }

  if (workLogStatus !== FORM_STATUS.SIGNED) {
    return 'Only work logs awaiting owner signature can be rejected.';
  }

  const hasContractorSignature = existingSignatures.some(
    (signature) =>
      getSignatureRoleType(signature, projectOwnerName, projectContractorName) === 'contractor'
  );

  if (!hasContractorSignature) {
    return 'This work log has no contractor signature to reject.';
  }

  return null;
};

export const validateDraftSignatures = (
  signatures: Signature[],
  projectOwnerName?: string,
  projectContractorName?: string
): string | null => {
  if (signatures.length === 0) {
    return null;
  }

  if (signatures.length > 1) {
    return 'A draft work log can only be signed by the contractor.';
  }

  return getSignatureAddError(signatures[0], [], projectOwnerName, projectContractorName);
};
