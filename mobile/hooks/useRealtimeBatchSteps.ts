import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

let channelCounter = 0;

/**
 * Keeps the team in sync: when anyone marks a step done or a new batch step
 * is generated, every connected device invalidates its cache and refetches.
 */
export function useRealtimeBatchSteps() {
  const queryClient = useQueryClient();
  const [channelName] = useState(() => `batch_steps_changes_${++channelCounter}`);

  useEffect(() => {
    const channel = supabase
      .channel(channelName)
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
