'use client';

import React, { useState, useEffect } from 'react';
import { SignaturePad } from './SignaturePad';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Plus, X } from 'lucide-react';
import type { Signature } from '@/types/shared';
import {
  getSignatureAddError,
  getSignatureRoleType,
  hasContractorThenOwnerSignatures
} from '@/lib/signatureUtils';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useProjectRole } from '@/hooks/useProjectRole';


interface SignatureSectionProps {
  signatures: Signature[];
  onChange: (signatures: Signature[]) => void;
  projectOwnerUserId?: string;
  projectContractorUserId?: string;
  allowDraftSignatureRemoval?: boolean;
}

export const SignatureSection: React.FC<SignatureSectionProps> = ({
  signatures,
  onChange,
  projectOwnerUserId,
  projectContractorUserId,
  allowDraftSignatureRemoval = true
}) => {
  const [showAddSignature, setShowAddSignature] = useState(false);
  const [newSignatureName, setNewSignatureName] = useState('');
  const [newSignatureRole, setNewSignatureRole] = useState('');
  const { user } = useCurrentUser();

  const projectRole = useProjectRole(
    user?.userId,
    projectOwnerUserId,
    projectContractorUserId
  );

  const handleAddSignatureClick = () => {
    if (user && projectRole) {
      setNewSignatureName(user.name);
      setNewSignatureRole(projectRole);
    }
    setShowAddSignature(true);
  };

  const addSignature = (signatureData: string) => {
    if (!newSignatureName.trim()) {
      alert('Please enter the name of the person signing.');
      return;
    }

    const newSignature: Signature = {
      data: signatureData,
      signedBy: newSignatureName.trim(),
      signedAt: new Date().toISOString(),
      projectRole: newSignatureRole.trim() || undefined,
      signedByUserId: user?.userId
    };

    const validationError = getSignatureAddError(
      newSignature,
      signatures,
      projectOwnerUserId,
      projectContractorUserId
    );

    if (validationError) {
      alert(validationError);
      return;
    }

    onChange([...signatures, newSignature]);
    setNewSignatureName('');
    setNewSignatureRole('');
    setShowAddSignature(false);
  };

  const removeSignature = (index: number) => {
    onChange(signatures.filter((_, i) => i !== index));
  };

  function canUserAddSignature() {
    if (!user) return false;
    if (showAddSignature) return false;
    if (hasContractorThenOwnerSignatures(signatures, projectOwnerUserId, projectContractorUserId)) {
      return false;
    }

    const hasUserSigned = signatures.some(
      (sig) => sig.signedByUserId === user.userId
    );

    const contractorHasSigned = signatures.some(
      (sig) => getSignatureRoleType(sig, projectOwnerUserId, projectContractorUserId) === 'contractor'
    );

    if (hasUserSigned || signatures.length >= 2) return false;
    if (projectRole === 'contractor') return signatures.length === 0;
    if (projectRole === 'owner') return signatures.length === 1 && contractorHasSigned;

    return false;
  }

  function canUserRemoveSignature(signature: Signature) {
    if (!allowDraftSignatureRemoval || !user) return false;
    if (signatures.length !== 1) return false;
    if (signature.signedByUserId !== user.userId) return false;

    return getSignatureRoleType(
      signature,
      projectOwnerUserId,
      projectContractorUserId
    ) === 'contractor';
  }

  const canAddSignature = canUserAddSignature();

  function getEmptyStateMessage() {
    if (canAddSignature) {
      return 'No signatures added yet. Click "Add Signature" to get started.';
    }
    if (!projectOwnerUserId && !projectContractorUserId) {
      return 'Signatures become available once the project has an owner and a contractor assigned.';
    }
    if (projectRole === 'owner') {
      return "The project's contractor must sign before the owner can countersign.";
    }
    return "Only the project's contractor can add the first signature.";
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Signatures</h3>
        { canAddSignature && (
          <Button
            type="button"
            onClick={handleAddSignatureClick}
            variant="outline"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Signature
          </Button>
        )}
      </div>

      {/* Existing Signatures */}
      {signatures.length > 0 && (
        <div className="space-y-3">
          {signatures.map((sig, index) => (
            <Card key={index}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-base">{sig.signedBy}</CardTitle>
                    {sig.projectRole && (
                      <p className="text-sm text-muted-foreground mt-1">{sig.projectRole}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Signed: {new Date(sig.signedAt).toLocaleString()}
                    </p>
                  </div>
                  {canUserRemoveSignature(sig) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSignature(index)}
                      aria-label={`Remove signature by ${sig.signedBy}`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg p-2 bg-card">
                  <img
                    src={sig.data}
                    alt={`Signature by ${sig.signedBy}`}
                    className="max-w-full h-auto max-h-32"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add New Signature */}
      {showAddSignature && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Signature</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Name
              </label>
              <div className="w-full rounded-md border bg-muted px-3 py-2 text-sm">
                  {newSignatureName || '-'}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Project Role
              </label>
              <div className="w-full rounded-md border bg-muted px-3 py-2 text-sm">
                  {newSignatureRole || '-'}
              </div>
            </div>

            <SignaturePad
              onSave={addSignature}
              title="Draw Signature"
            />

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowAddSignature(false);
                setNewSignatureName('');
                setNewSignatureRole('');
              }}
              className="w-full"
            >
              Cancel
            </Button>
          </CardContent>
        </Card>
      )}

      {signatures.length === 0 && !showAddSignature && (
        <p className="text-sm text-muted-foreground text-center py-4">
          {getEmptyStateMessage()}
        </p>
      )}
    </div>
  );
};
