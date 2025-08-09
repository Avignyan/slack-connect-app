// frontend/src/App.tsx
import { useState, useEffect } from 'react';
import { Box, CircularProgress, CssBaseline } from '@mui/material';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';

function App() {
    const backendUrl = 'https://avigyan-slack-scheduler.loca.lt';
    const [isConnected, setIsConnected] = useState<boolean | null>(null);

    useEffect(() => {
        const checkConnection = async () => {
            try {
                const response = await fetch(`${backendUrl}/api/channels`);
                setIsConnected(response.ok);
            } catch (error) {
                setIsConnected(false);
            }
        };
        checkConnection();
    }, []); // Removed backendUrl from dependencies as it's constant

    const handleLogout = async () => {
        if (!window.confirm('Are you sure you want to disconnect your workspace?')) return;

        try {
            const response = await fetch(`${backendUrl}/api/logout`, {
                method: 'POST',
            });
            if (response.ok) {
                // Set connected to false to show the login page
                setIsConnected(false);
            } else {
                alert('Logout failed. Please try again.');
            }
        } catch (error) {
            console.error('Logout error:', error);
            alert('An error occurred during logout.');
        }
    };

    const renderContent = () => {
        if (isConnected === null) {
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
                    <CircularProgress />
                </Box>
            );
        }
        return isConnected ? <DashboardPage /> : <LoginPage backendUrl={backendUrl} />;
    };

    return (
        <>
            <CssBaseline />
            {/* Pass the state and handler to the Navbar */}
            <Navbar isConnected={isConnected} onLogout={handleLogout} />
            {renderContent()}
        </>
    );
}

export default App;