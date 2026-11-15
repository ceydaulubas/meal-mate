import { profileSchema, spaceSchema, type Profile, type Space } from '@meal-mate/contracts';
import { getSupabaseClient } from '@/lib/supabase/client';

export interface DashboardData {
  profile: Profile;
  spaces: Space[];
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const supabase = getSupabaseClient();

  const [profileResult, spacesResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, display_name, avatar_url, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('spaces')
      .select('id, name, type, created_by, created_at, updated_at')
      .order('created_at', { ascending: true }),
  ]);

  if (profileResult.error) {
    throw new Error(`Unable to load your profile: ${profileResult.error.message}`);
  }

  if (!profileResult.data) {
    throw new Error('Your profile could not be found.');
  }

  if (spacesResult.error) {
    throw new Error(`Unable to load your spaces: ${spacesResult.error.message}`);
  }

  return {
    profile: profileSchema.parse(profileResult.data),
    spaces: spaceSchema.array().parse(spacesResult.data),
  };
}
