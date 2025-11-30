"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function Auth({ onLogin }: { onLogin: () => void }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [accessCode, setAccessCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const supabase = createClient();

    const SIGNUP_ACCESS_CODE = "4545";

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            if (isSignUp) {
                // Validate access code for sign up
                if (accessCode !== SIGNUP_ACCESS_CODE) {
                    throw new Error("invalid access code. contact admin for access.");
                }

                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                setMessage("check ur email for the confirmation link!");
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                onLogin();
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>{isSignUp ? "create an account" : "welcome to the ib tracker"}</CardTitle>
                    <CardDescription>
                        {isSignUp
                            ? "create ur account to save ur stuff"
                            : "sign in and access ur stuff anywhere"}
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleAuth} className="flex flex-col gap-6">
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="d@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">password</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        {isSignUp && (
                            <div className="space-y-2">
                                <Label htmlFor="accessCode">access code (api usage is expensive) </Label>
                                <Input
                                    id="accessCode"
                                    type="text"
                                    placeholder="enter access code"
                                    value={accessCode}
                                    onChange={(e) => setAccessCode(e.target.value)}
                                    required
                                />
                            </div>
                        )}
                        {error && <p className="text-sm text-red-500">{error}</p>}
                        {message && <p className="text-sm text-green-500">{message}</p>}
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4">
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? "Loading..." : isSignUp ? "sign up" : "sign in"}
                        </Button>
                        <Button
                            type="button"
                            variant="link"
                            onClick={() => setIsSignUp(!isSignUp)}
                            className="text-sm text-muted-foreground"
                        >
                            {isSignUp
                                ? "already have an account? sign in"
                                : "don't have an account? sign up"}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
