import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user?: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      teamId: string;
    };
  }

  interface User {
    teamId: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    teamId: string;
  }
}
