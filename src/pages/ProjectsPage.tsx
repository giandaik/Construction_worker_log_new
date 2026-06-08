import { View, FlatList, ActivityIndicator } from 'react-native';
import { useQuery } from 'react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import styled from 'styled-components/native';
import { useColorScheme } from 'react-native';
import { Colors } from '../constants/Colors';

interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'on-hold';
  createdAt: string;
}

export function ProjectsPage() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { data: projects, isLoading, error } = useQuery<Project[]>('projects', fetchProjects);

  if (isLoading) {
    return (
      <LoadingContainer>
        <ActivityIndicator size="large" color={isDark ? Colors.primary : Colors.primary} />
      </LoadingContainer>
    );
  }

  if (error) {
    return (
      <ErrorContainer>
        <ErrorText>Something went wrong. Please try again later.</ErrorText>
      </ErrorContainer>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Container>
        <Header>
          <Title>Projects</Title>
          <AddButton onPress={() => {/* TODO: Implement new project creation */}}>
            <AddButtonText>+ New Project</AddButtonText>
          </AddButton>
        </Header>

        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ProjectCard>
              <ProjectName>{item.name}</ProjectName>
              <ProjectDescription>{item.description}</ProjectDescription>
              <StatusBadge status={item.status}>
                <StatusText>{item.status}</StatusText>
              </StatusBadge>
            </ProjectCard>
          )}
          contentContainerStyle={{ padding: 16 }}
        />
      </Container>
    </SafeAreaView>
  );
}

const Container = styled.View`
  flex: 1;
  background-color: ${props => props.theme.colors.background};
`;

const LoadingContainer = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
`;

const ErrorContainer = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
  padding: 16px;
`;

const ErrorText = styled.Text`
  color: ${props => props.theme.colors.error};
  font-size: 16px;
  text-align: center;
`;

const Header = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom-width: 1px;
  border-bottom-color: ${props => props.theme.colors.border};
`;

const Title = styled.Text`
  font-size: 24px;
  font-weight: bold;
  color: ${props => props.theme.colors.text};
`;

const AddButton = styled.TouchableOpacity`
  background-color: ${props => props.theme.colors.primary};
  padding: 8px 16px;
  border-radius: 8px;
`;

const AddButtonText = styled.Text`
  color: white;
  font-weight: bold;
`;

const ProjectCard = styled.View`
  background-color: ${props => props.theme.colors.card};
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 12px;
  elevation: 2;
  shadow-color: #000;
  shadow-offset: 0px 2px;
  shadow-opacity: 0.25;
  shadow-radius: 3.84px;
`;

const ProjectName = styled.Text`
  font-size: 18px;
  font-weight: bold;
  color: ${props => props.theme.colors.text};
  margin-bottom: 8px;
`;

const ProjectDescription = styled.Text`
  font-size: 14px;
  color: ${props => props.theme.colors.text};
  opacity: 0.8;
  margin-bottom: 12px;
`;

const StatusBadge = styled.View<{ status: string }>`
  align-self: flex-start;
  padding: 4px 8px;
  border-radius: 4px;
  background-color: ${props => {
    switch (props.status) {
      case 'active':
        return props.theme.colors.success;
      case 'completed':
        return props.theme.colors.primary;
      case 'on-hold':
        return props.theme.colors.warning;
      default:
        return props.theme.colors.gray;
    }
  }};
`;

const StatusText = styled.Text`
  color: white;
  font-size: 12px;
  text-transform: capitalize;
`;

async function fetchProjects(): Promise<Project[]> {
  // TODO: Implement actual API call
  return [
    {
      id: '1',
      name: 'Mobile App Development',
      description: 'Building a new mobile app using React Native and Expo',
      status: 'active',
      createdAt: new Date().toISOString(),
    },
    // Add more mock data as needed
  ];
} 