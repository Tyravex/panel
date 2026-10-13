import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useNotificationStore } from '../model/notifications.store';
import { getNotifications } from '../api/notifications.api';
import { useUser } from "@/shared/store/user";
import { markAsRead } from '../api/notifications.api';

export const useNotifications = () => {
    const { user } = useUser();
    const { setNotifications, addNotification, markAsRead: markLocalAsRead } = useNotificationStore();

    useEffect(() => {
        if (!user) return;

        getNotifications().then((res) => setNotifications(res.data));

        const socket = io('http://localhost:3000', {
            withCredentials: true,
            autoConnect: true,
        });

        socket.on("connect", () => {
            console.log("✅ Socket connected:", socket.id);
        });

        socket.on("connect_error", (err) => {
            console.log("❌ CONNECT ERROR:", err.message);
        });

        socket.on("notification", (data) => {
            console.log("📩 Notification:", data);

            if (!data?.id || !data?.createdAt) {
                console.log("❌ Invalid notification skipped:", data);
                return;
            }

            addNotification({
                id: Number(data.id),
                content: data.content ?? '',
                createdAt: data.createdAt,
                read: false,
            });
        });

        return () => {
            socket.disconnect();
        };
    }, [user, addNotification, setNotifications]);

    const markAsReadHandler = async (id: number) => {
        if (!id) return;
        await markAsRead(id);
        markLocalAsRead(id);
    };

    return { markAsReadHandler };
};