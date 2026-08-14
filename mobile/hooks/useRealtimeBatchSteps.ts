import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

/**
 * Keeps the team in sync: when anyone marks a step done or a new batch step
 * is generated, every connected device invalidates its cache and refetches.
 */
export function useRealtimeBatchSteps() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('batch_steps_changes')
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
