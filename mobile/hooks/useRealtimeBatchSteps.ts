import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

let channelCounter = 0;

/**
 * Keeps the team in sync: when anyone marks a step done or a new batch step
 * is generated, every connected device invalidates its cache and refetches.
 */
export function useRealtimeBatchSteps() {
  const queryClient = useQueryClient();
  const channelNameRef = useRef<string | null>(null);
  if (channelNameRef.current === null) {
    channelNameRef.current = `batch_steps_changes_${++channelCounter}`;
  }

  useEffect(() => {
    const channel = supabase
      .channel(channelNameRef.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'batch_steps' }, () => {
        queryClient.invalidateQueries({ queryKey: ['batchSteps'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'batches' }, () => {
        queryClient.invalidateQueries({ queryKey: ['batches'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
