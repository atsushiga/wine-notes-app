"use client";

import { LogOut } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { useTransition } from "react";

export default function LogoutButton() {
    const [isPending, startTransition] = useTransition();

    const handleLogout = () => {
        startTransition(async () => {
            await signOut();
        });
    };

    return (
        <button
            onClick={handleLogout}
            disabled={isPending}
            className="w-full flex items-center justify-center space-x-2 bg-white border border-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
            <LogOut size={20} />
            <span>ログアウト</span>
        </button>
    );
}
