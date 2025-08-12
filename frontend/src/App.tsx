import { useState, useEffect } from 'react';
import { Box, CircularProgress, CssBaseline } from '@mui/material';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';

// Define the user info type with channels included
export interface UserInfo {
    token: string;
    userId: string;
    teamId: string;
    userName?: string;
    teamName?: string;
    teamIcon?: string;
    expiresAt?: string;
    channels?: any[]; // Add channels to store them from OAuth
    accessToken?: string; // For backward compatibility
    userToken?: string; // Added for user token support
    botToken?: string; // Added for explicit bot token support
}

function App() {
    // This is the correct backendUrl - keep this
    const backendUrl = 'https://slack-connect-ap.netlify.app/.netlify/functions/api';
    const [isConnected, setIsConnected] = useState<boolean | null>(null);
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // First check if there's userInfo or auth=success in the URL parameters
        const params = new URLSearchParams(window.location.search);
        const userInfoParam = params.get('userInfo');
        //const authStatus = params.get('auth');

        if (userInfoParam) {
            try {
                // Clear the URL parameter to avoid keeping it in browser history
                window.history.replaceState({}, document.title, window.location.pathname);

                const parsedUserInfo = JSON.parse(decodeURIComponent(userInfoParam)) as UserInfo;

                // Ensure token is set correctly (might be in accessToken)
                if (!parsedUserInfo.token && parsedUserInfo.accessToken) {
                    parsedUserInfo.token = parsedUserInfo.accessToken;
                }

                // Ensure botToken is set (for backward compatibility)
                if (!parsedUserInfo.botToken) {
                    parsedUserInfo.botToken = parsedUserInfo.token;
                }

                console.log('Auth tokens available:', {
                    mainToken: !!parsedUserInfo.token,
                    userToken: !!parsedUserInfo.userToken,
                    botToken: !!parsedUserInfo.botToken
                });

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

                // Ensure token is set correctly (might be in accessToken)
                if (!parsedUserInfo.token && parsedUserInfo.accessToken) {
                    parsedUserInfo.token = parsedUserInfo.accessToken;
                }

                // Ensure botToken is set (for backward compatibility)
                if (!parsedUserInfo.botToken) {
                    parsedUserInfo.botToken = parsedUserInfo.token;
                }

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
                // Check if the stored token is valid
                if (storedUserInfo) {
                    const parsedUserInfo = JSON.parse(storedUserInfo) as UserInfo;

                    // FIX: Remove the duplicate /api from the path
                    const response = await fetch(`${backendUrl}/channels`, {
                        headers: {
                            'Authorization': `Bearer ${parsedUserInfo.token || parsedUserInfo.accessToken}`
                        }
                    });

                    // If the token is invalid, clear it
                    if (!response.ok) {
                        console.log('Stored token is invalid, clearing it');
                        localStorage.removeItem('userInfo');
                        setIsConnected(false);
                    } else {
                        // If channels request succeeds, store the channels too
                        const channels = await response.json();
                        parsedUserInfo.channels = channels;

                        setUserInfo(parsedUserInfo);
                        setIsConnected(true);

                        // Update localStorage with channels
                        localStorage.setItem('userInfo', JSON.stringify(parsedUserInfo));
                    }
                } else {
                    setIsConnected(false);
                }
            } catch (error) {
                console.error('Connection check failed:', error);
                localStorage.removeItem('userInfo');
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
            // FIX: Remove the duplicate /api from the path
            const response = await fetch(`${backendUrl}/logout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userInfo?.token || userInfo?.accessToken || ''}`
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
        // Ensure token is set correctly (might be in accessToken)
        if (!newUserInfo.token && newUserInfo.accessToken) {
            newUserInfo.token = newUserInfo.accessToken;
        }

        // Ensure botToken is set (for backward compatibility)
        if (!newUserInfo.botToken) {
            newUserInfo.botToken = newUserInfo.token;
        }

        console.log('Auth tokens available:', {
            mainToken: !!newUserInfo.token,
            userToken: !!newUserInfo.userToken,
            botToken: !!newUserInfo.botToken
        });

        // Save to localStorage and update state
        localStorage.setItem('userInfo', JSON.stringify(newUserInfo));
        setUserInfo(newUserInfo);
        setIsConnected(true);
    };

    // Define a function to validate icon URL
    const getValidIconUrl = (url: string | undefined): string | undefined => {
        if (!url) return undefined;

        // Check if it's a valid URL
        try {
            new URL(url); // This will throw if invalid
            return url;
        } catch (e) {
            console.warn('Invalid team icon URL:', url);
            return undefined;
        }
    };

    if (isLoading) {
        return (
            <>
                <CssBaseline />
                <Navbar
                    isConnected={null}
                    onLogout={handleLogout}
                    userName={undefined}
                    teamName={undefined}
                    teamIcon={undefined}
                    userInfo={null}
                    backendUrl={backendUrl}
                />
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
                teamName={userInfo?.teamName}
                teamIcon={getValidIconUrl(userInfo?.teamIcon)}
                userInfo={userInfo}
                backendUrl={backendUrl}
            />
            {isConnected
                ? <DashboardPage userInfo={userInfo} />
                : <LoginPage backendUrl={backendUrl} onLoginSuccess={handleLoginSuccess} />
            }
        </>
    );
}

export default App;