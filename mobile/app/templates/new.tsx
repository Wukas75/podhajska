import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useCreateTemplate } from '../../hooks/useTemplates';

export default function NewTemplateScreen() {
  const [name, setName] = useState('');
  const [style, setStyle] = useState('');
  const [description, setDescription] = useState('');
  const createTemplate = useCreateTemplate();

  function handleCreate() {
    if (!name.trim()) return;
    createTemplate.mutate(
      { name: name.trim(), style: style.trim() || null, description: description.trim() || null },
      {
        onSuccess: (template) => {
          router.replace({ pathname: '/templates/[id]', params: { id: template.id } });
        },
      }
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Nová šablóna</Text>

        <TextInput style={styles.input} placeholder="Názov (napr. IPA — 7 dní)" value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="Štýl (napr. IPA)" value={style} onChangeText={setStyle} />
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Popis (voliteľné)"
          value={description}
          onChangeText={setDescription}
          multiline
        />

        {createTemplate.error && <Text style={styles.error}>{(createTemplate.error as Error).message}</Text>}

        <Pressable
          style={[styles.button, (!name.trim() || createTemplate.isPending) && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={!name.trim() || createTemplate.isPending}
        >
          <Text style={styles.buttonText}>{createTemplate.isPending ? 'Vytváram...' : 'Vytvoriť a pridať kroky'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  error: { color: '#c62828', marginBottom: 12 },
  button: { backgroundColor: '#1a1a1a', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
