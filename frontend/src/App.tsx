// frontend/src/App.tsx
import { useState, useEffect } from 'react';
import { Box, CircularProgress, CssBaseline } from '@mui/material';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';

// Define the user info type
export interface UserInfo {
    token: string;
    userId: string;
    teamId: string;
    userName?: string;
    expiresAt?: string;
}

function App() {
    const backendUrl = 'https://avigyan-slack-scheduler.loca.lt';
    const [isConnected, setIsConnected] = useState<boolean | null>(null);
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // First check if there's userInfo in the URL parameters (from OAuth callback)
        const params = new URLSearchParams(window.location.search);
        const userInfoParam = params.get('userInfo');

        if (userInfoParam) {
            try {
                // Clear the URL parameter to avoid keeping it in browser history
                window.history.replaceState({}, document.title, window.location.pathname);

                const parsedUserInfo = JSON.parse(decodeURIComponent(userInfoParam)) as UserInfo;
                setUserInfo(parsedUserInfo);
                setIsConnected(true);
                setIsLoading(false);

                // Save to localStorage for persistence
                localStorage.setItem('userInfo', JSON.stringify(parsedUserInfo));
                return;
            } catch (error) {
                console.error('Error parsing user info from URL:', error);
            }
        }

        // If no URL parameter, try localStorage as before
        const storedUserInfo = localStorage.getItem('userInfo');
        if (storedUserInfo) {
            try {
                const parsedUserInfo = JSON.parse(storedUserInfo) as UserInfo;

                // Check if token is expired
                if (parsedUserInfo.expiresAt) {
                    const expiryDate = new Date(parsedUserInfo.expiresAt);
                    if (expiryDate > new Date()) {
                        // Token is still valid
                        setUserInfo(parsedUserInfo);
                        setIsConnected(true);
                        setIsLoading(false);
                        return;
                    }
                }

                // Token expired or no expiry date, clear it
                localStorage.removeItem('userInfo');
            } catch (e) {
                // Invalid JSON, clear it
                localStorage.removeItem('userInfo');
            }
        }

        // Check connection if no valid user info
        const checkConnection = async () => {
            try {
                const response = await fetch(`${backendUrl}/api/channels`);
                setIsConnected(response.ok);
            } catch (error) {
                setIsConnected(false);
            } finally {
                setIsLoading(false);
            }
        };
        checkConnection();
    }, [backendUrl]);

    const handleLogout = async () => {
        if (!window.confirm('Are you sure you want to disconnect your workspace?')) return;

        try {
            const response = await fetch(`${backendUrl}/api/logout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userInfo?.token || ''}`
                }
            });

            if (response.ok) {
                // Clear local storage and state
                localStorage.removeItem('userInfo');
                setUserInfo(null);
                setIsConnected(false);
            } else {
                alert('Logout failed. Please try again.');
            }
        } catch (error) {
            console.error('Logout error:', error);
            alert('An error occurred during logout.');
        }
    };

    const handleLoginSuccess = (newUserInfo: UserInfo) => {
        // Save to localStorage and update state
        localStorage.setItem('userInfo', JSON.stringify(newUserInfo));
        setUserInfo(newUserInfo);
        setIsConnected(true);
    };

    if (isLoading) {
        return (
            <>
                <CssBaseline />
                <Navbar isConnected={null} onLogout={handleLogout} />
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
                    <CircularProgress />
                </Box>
            </>
        );
    }

    return (
        <>
            <CssBaseline />
            <Navbar
                isConnected={isConnected}
                onLogout={handleLogout}
                userName={userInfo?.userName}
            />
            {isConnected
                ? <DashboardPage userInfo={userInfo} />
                : <LoginPage backendUrl={backendUrl} onLoginSuccess={handleLoginSuccess} />
            }
        </>
    );
}

export default App;