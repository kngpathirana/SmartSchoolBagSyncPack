import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { db } from '../../lib/firebase';

export function useFirebaseConnection() {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const connectedRef = ref(db, '.info/connected');
    const unsubscribe = onValue(connectedRef, (snapshot) => {
      setIsConnected(snapshot.val() === true);
    });

    return () => unsubscribe();
  }, []);

  return isConnected;
}
