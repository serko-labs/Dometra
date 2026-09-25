import { supabase } from '../lib/supabase';

export async function loadWorkspaceProperties(workspaceId: string) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function uploadMeterPhoto(params: {
  workspaceId: string;
  propertyId: string;
  meterId: string;
  registerCode: string;
  userId: string;
  fileUri: string;
}) {
  if (!supabase) throw new Error('Supabase is not configured');
  const response = await fetch(params.fileUri);
  const fileData = await response.arrayBuffer();
  const month = new Date().toISOString().slice(0, 7);
  const path = `${params.workspaceId}/${params.propertyId}/${params.meterId}/${month}/${params.registerCode}/${Date.now()}.jpg`;

  const { error: uploadError } = await supabase.storage.from('meter-photos').upload(path, fileData, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('media_files')
    .insert({
      workspace_id: params.workspaceId,
      property_id: params.propertyId,
      bucket: 'meter-photos',
      storage_path: path,
      mime_type: 'image/jpeg',
      uploaded_by: params.userId,
      captured_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
