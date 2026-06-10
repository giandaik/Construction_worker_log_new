'use client';

import React, { useState, useEffect } from 'react';
import { SignaturePad } from './SignaturePad';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Plus, X } from 'lucide-react';
import type { Signature } from '@/types/shared';
import { getSignatureAddError } from '@/lib/signatureUtils';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useProjectRole } from '@/hooks/useProjectRole';


interface SignatureSectionProps {
  signatures: Signature[];
  onChange: (signatures: Signature[]) => void;
  projectOwnerUserId?: string;
  projectContractorUserId?: string;
}

export const SignatureSection: React.FC<SignatureSectionProps> = ({
  signatures,
  onChange,
  projectOwnerUserId,
  projectContractorUserId
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
    console.log('Current user:', user);
    console.log('Project role:', projectRole);

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

  //const isAuthorized = user && (user.role === 'admin' || user.role === 'supervisor');
  function canUserAddSignature({
    user,
    signatures,
    projectOwnerUserId,
    projectContractorUserId,
    showAddSignature,
    projectRole
  }: any) {
    if (!user) return false;

    const hasUserSigned = signatures.some(
      (sig: any) => sig.signedByUserId === user.userId
    );

    const contractorHasSigned = signatures.some(
      (sig: any) => sig.projectRole === 'contractor'
    );

    

    const isAllowedByRole =
      projectRole === 'contractor'
        ? true
        : projectRole === 'owner'
          ? contractorHasSigned
          : false;

    return (
      !showAddSignature &&
      signatures.length < 2 &&
      !hasUserSigned &&
      isAllowedByRole
    );
  }


  const canAddSignature = canUserAddSignature({
    user,
    signatures,
    projectOwnerUserId,
    projectContractorUserId,
    showAddSignature,
    projectRole
  });

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
                      <p className="text-sm text-gray-500 mt-1">{sig.projectRole}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Signed: {new Date(sig.signedAt).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSignature(index)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg p-2 bg-white">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name 
              </label>              
              <div className="w-full rounded-md border bg-gray-100 px-3 py-2 text-sm">
                  {newSignatureName || '-'}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project Role
              </label>
              <div className="w-full rounded-md border bg-gray-100 px-3 py-2 text-sm">
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
        <p className="text-sm text-gray-500 text-center py-4">
          No signatures added yet. Click "Add Signature" to get started.
        </p>
      )}
    </div>
  );
};
