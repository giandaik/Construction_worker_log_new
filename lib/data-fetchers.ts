// Type definitions for API responses
export interface ProjectWithId {
  _id: string;
  name: string;
  description?: string;
  location?: string;
  ownerName?: string;
  contractorName?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  client?: string;
  budget?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserWithId {
  _id: string;
  name: string;
  email: string;
  role?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Fetch all projects from the API
 */
export async function fetchProjects(): Promise<ProjectWithId[]> {
  try {
    const response = await fetch('/api/projects');
    if (!response.ok) {
      throw new Error('Failed to fetch projects');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching projects:', error);
    return [];
  }
}

/**
 * Fetch all users from the API
 */
export async function fetchUsers(): Promise<UserWithId[]> {
  try {
    const response = await fetch('/api/users');
    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
}

/**
 * Create a new project
 */
export async function createProject(projectData: { 
  name: string; 
  description?: string;
  location?: string;
  ownerName: string;
  contractorName: string;
}): Promise<ProjectWithId | null> {
  try {
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(projectData),
    });

    if (!response.ok) {
      throw new Error('Failed to create project');
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating project:', error);
    return null;
  }
}

/**
 * Create a new user
 */
export async function createUser(userData: {
  name: string;
  email: string;
}): Promise<UserWithId | null> {
  try {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      throw new Error('Failed to create user');
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating user:', error);
    return null;
  }
} 