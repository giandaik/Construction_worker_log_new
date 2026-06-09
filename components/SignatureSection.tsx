'use client';

import React, { useState, useEffect } from 'react';
import { SignaturePad } from './SignaturePad';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Plus, X } from 'lucide-react';
import type { Signature } from '@/types/shared';
import { getSignatureAddError } from '@/lib/signatureUtils';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface SignatureSectionProps {
  signatures: Signature[];
  onChange: (signatures: Signature[]) => void;
  projectOwnerName?: string;
  projectContractorName?: string;
}

export const SignatureSection: React.FC<SignatureSectionProps> = ({
  signatures,
  onChange,
  projectOwnerName,
  projectContractorName,
}) => {
  const [showAddSignature, setShowAddSignature] = useState(false);
  const [newSignatureName, setNewSignatureName] = useState('');
  const [newSignatureRole, setNewSignatureRole] = useState('');
  const { user } = useCurrentUser();

  const handleAddSignatureClick = () => {
    if (user) {
      setNewSignatureName(user.name);
      setNewSignatureRole(user.role);
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
      role: newSignatureRole.trim() || undefined,
    };

    const validationError = getSignatureAddError(
      newSignature,
      signatures,
      projectOwnerName,
      projectContractorName
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

  const hasUserSigned = user ? signatures.some((sig) => sig.signedBy === user.name) : false;

  const canAddSignature =  !showAddSignature &&  signatures.length < 2 &&  !hasUserSigned;

  const canAddSing = () => {
          {console.log('Can add signature:', canAddSignature, 'Show add signature:', showAddSignature, 'Has user signed:', hasUserSigned, 'Current signatures:', signatures)}
          return true;

  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Signatures</h3>
        {canAddSignature && (
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
      {projectOwnerName && projectContractorName && (
        <p className="text-sm text-gray-500">
          Signature order is required: the contractor (&quot;{projectContractorName}&quot;) must sign before the owner (&quot;{projectOwnerName}&quot;).
        </p>
      )}

      {/* Existing Signatures */}
      {signatures.length > 0 && (
        <div className="space-y-3">
          {signatures.map((sig, index) => (
            <Card key={index}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-base">{sig.signedBy}</CardTitle>
                    {sig.role && (
                      <p className="text-sm text-gray-500 mt-1">{sig.role}</p>
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
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newSignatureName}
                onChange={(e) => setNewSignatureName(e.target.value)}
                placeholder="Enter signer's name"
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role (Optional)
              </label>
              <input
                type="text"
                value={newSignatureRole}
                onChange={(e) => setNewSignatureRole(e.target.value)}
                placeholder="e.g., Supervisor, Project Manager"
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              />
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
