import { useUser } from '@/shared/store/user';

export const DashboardPage = () => {
   const user = useUser((state) => state.user);

   if (!user) return null;

    return (
        <div>
            <h1>Witaj, {user.username}</h1>
            <p>Email: {user.email}</p>
            <p>Lang : {user.language}</p>
        </div>
    );
};