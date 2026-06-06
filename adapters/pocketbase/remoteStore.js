// PocketBase RemoteStore — stub for the self-hosted backend on the Pi5
// (pb.lanube.com). Declares the RemoteStore surface so the wiring is in place;
// implement against the PocketBase JS SDK / REST API when we point at it.
export function createPocketbaseRemoteStore() {
  const todo = (op) => async () => {
    throw new Error(`PocketBase adapter (pb.lanube.com) aún no implementa "${op}". Usa backend 'local' o 'supabase'.`);
  };
  return {
    saveActivity: todo('saveActivity'),
    deleteActivity: todo('deleteActivity'),
    getActivity: todo('getActivity'),
    listActivities: todo('listActivities'),
    saveResult: todo('saveResult'),
    listResults: todo('listResults'),
  };
}

export default createPocketbaseRemoteStore;
