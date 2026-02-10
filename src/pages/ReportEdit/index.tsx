import { Title, Text, Container } from '@mantine/core';

interface ReportEditProps {
  params?: { id?: string };
}

export function ReportEdit({ params }: ReportEditProps) {
  const id = params?.id;
  return (
    <Container size="md" py="xl">
      <Title order={2}>Editar reporte</Title>
      <Text c="dimmed" mt="sm">
        {id ? `Reporte ID: ${id} (formulario en desarrollo)` : 'ID no especificado'}
      </Text>
    </Container>
  );
}
