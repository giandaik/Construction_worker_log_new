'use client';

import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SignaturePadProps {
  onSave: (signature: string) => void;
  existingSignature?: string;
  title?: string;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  onSave,
  existingSignature,
  title = 'Signature',
}) => {
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [isSigned, setIsSigned] = useState(!!existingSignature);

  const clear = () => {
    sigCanvas.current?.clear();
    setIsSigned(false);
  };

  const save = () => {
    if (sigCanvas.current?.isEmpty()) {
      alert('Please provide a signature first.');
      return;
    }

    const signatureData = sigCanvas.current?.toDataURL('image/png');
    if (signatureData) {
      onSave(signatureData);
      setIsSigned(true);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-2 border-input rounded-lg bg-card">
          {existingSignature && isSigned ? (
            <div className="p-4">
              <img
                src={existingSignature}
                alt="Signature"
                className="max-w-full h-auto"
              />
            </div>
          ) : (
            <SignatureCanvas
              ref={sigCanvas}
              canvasProps={{
                className: 'w-full h-40 cursor-crosshair touch-none',
              }}
              backgroundColor="white"
            />
          )}
        </div>

        <div className="flex gap-2">
          {!isSigned || !existingSignature ? (
            <>
              <Button type="button" onClick={save} className="flex-1">
                Save Signature
              </Button>
              <Button type="button" onClick={clear} variant="outline" className="flex-1">
                Clear
              </Button>
            </>
          ) : (
            <Button
              type="button"
              onClick={() => setIsSigned(false)}
              variant="outline"
              className="w-full"
            >
              Edit Signature
            </Button>
          )}
        </div>

        {isSigned && existingSignature && (
          <p className="text-sm text-success text-center">
            ✓ Signature saved
          </p>
        )}
      </CardContent>
    </Card>
  );
};
