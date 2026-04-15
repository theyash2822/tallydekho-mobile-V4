import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { DocumentType } from '../../src/types/document';
import { getDocument } from '../../src/data/mockDocuments';
import DocumentPreviewPage from '../../src/components/document/DocumentPreviewPage';

export default function DocumentPage() {
  const params = useLocalSearchParams<{ id: string; type?: string }>();
  const doc = getDocument(params.id, params.type as DocumentType | undefined);
  return <DocumentPreviewPage document={doc} />;
}
