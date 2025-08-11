// frontend/src/pages/LoginPage.tsx
import { useState } from 'react';
import { Container, Typography, Box, Button, TextField, Paper, Divider } from '@mui/material';
import type { UserInfo } from '../App';

type LoginPageProps = {
    backendUrl: string;
    onLoginSuccess: (userInfo: UserInfo) => void;
};

const LoginPage = ({ backendUrl, onLoginSuccess }: LoginPageProps) => {
    const [userId, setUserId] = useState('');
    const [teamId, setTeamId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const response = await fetch(`${backendUrl}/api/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId, teamId }),
            });

            const data = await response.json();

            if (response.ok) {
                onLoginSuccess({
                    token: data.token,
                    userId: data.userId,
                    teamId: data.teamId,
                    userName: data.userName,
                    expiresAt: data.expiresAt
                });
            } else {
                setError(data.error || 'Login failed. Please check your credentials.');
            }
        } catch (error) {
            console.error('Login error:', error);
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Container maxWidth="sm">
            <Box
                sx={{
                    mt: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                }}
            >
                <Typography component="h1" variant="h4" gutterBottom>
                    Welcome to ConnectFlow
                </Typography>
                <Typography variant="h6" color="text.secondary" paragraph>
                    Connect your workspace to send and schedule messages with ease.
                </Typography>

                <Paper elevation={3} sx={{ p: 4, width: '100%', mt: 2 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {/* Connect with Slack Section */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Typography variant="h6" align="center">
                                Connect with Slack
                            </Typography>
                            <Box sx={{ mt: 2 }}>
                                <a href={`${backendUrl}/slack/install`}>
                                    <img
                                        alt="Add to Slack"
                                        height="40"
                                        width="139"
                                        src="https://platform.slack-edge.com/img/add_to_slack.png"
                                        srcSet="https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x"
                                    />
                                </a>
                            </Box>
                        </Box>

                        {/* Divider */}
                        <Box sx={{ width: '100%', display: 'flex', alignItems: 'center' }}>
                            <Divider sx={{ flexGrow: 1 }} />
                            <Typography variant="body2" color="text.secondary" sx={{ mx: 2 }}>
                                OR
                            </Typography>
                            <Divider sx={{ flexGrow: 1 }} />
                        </Box>

                        {/* Login Section */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                            <Typography variant="h6" align="center" gutterBottom>
                                Login with Existing Credentials
                            </Typography>

                            <Box component="form" onSubmit={handleLogin} sx={{ mt: 2, width: '100%' }}>
                                {error && (
                                    <Typography color="error" align="center" sx={{ mb: 2 }}>
                                        {error}
                                    </Typography>
                                )}

                                <TextField
                                    label="User ID"
                                    fullWidth
                                    margin="normal"
                                    value={userId}
                                    onChange={(e) => setUserId(e.target.value)}
                                    required
                                    disabled={isLoading}
                                />

                                <TextField
                                    label="Team ID"
                                    fullWidth
                                    margin="normal"
                                    value={teamId}
                                    onChange={(e) => setTeamId(e.target.value)}
                                    required
                                    disabled={isLoading}
                                />

                                <Button
                                    type="submit"
                                    fullWidth
                                    variant="contained"
                                    sx={{ mt: 3, mb: 2 }}
                                    disabled={isLoading || !userId || !teamId}
                                >
                                    {isLoading ? 'Logging in...' : 'Login'}
                                </Button>
                            </Box>
                        </Box>
                    </Box>
                </Paper>
            </Box>
        </Container>
    );
};

export default LoginPage;