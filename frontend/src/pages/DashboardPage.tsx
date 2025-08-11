/**
 * Dashboard Page Component
 * Provides interface for sending immediate and scheduled Slack messages
 *
 * Features:
 * - Channel selection
 * - Message composition
 * - Immediate message sending
 * - Message scheduling
 * - Scheduled message management (view/cancel)
 *
 * @author Avignyan
 * @lastUpdated 2025-08-11
 */

import { useState, useEffect, useCallback } from 'react';
import {
    Container, Typography, Box, Select, MenuItem, TextField,
    Button, FormControl, InputLabel, CircularProgress, Switch,
    FormControlLabel, Paper, Divider, IconButton, Tooltip,
    Chip, Card, CardContent, Alert, Snackbar
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import AlarmIcon from '@mui/icons-material/Alarm';
import ScheduledMessagesList from '../components/ScheduledMessagesList';
// Use type-only import here
import type { UserInfo } from '../App';

// Define types for our data structures
type SlackChannel = { id: string; name: string };
type ScheduledMessage = { id: string; channelId: string; message: string; sendAt: string };

// Update props to include userInfo
type DashboardPageProps = {
    userInfo: UserInfo | null;
};

/**
 * DashboardPage component
 * Main interface for Slack message management
 */
const DashboardPage = ({ userInfo }: DashboardPageProps) => {
    // Backend API URL
    const backendUrl = 'https://avigyan-slack-scheduler.loca.lt';

    // State management
    const [channels, setChannels] = useState<SlackChannel[]>([]);
    const [selectedChannel, setSelectedChannel] = useState('');
    const [message, setMessage] = useState('');
    const [scheduleDate, setScheduleDate] = useState('');
    const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [sendAsUser, setSendAsUser] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'success' as 'success' | 'error'
    });

    /**
     * Calculate minimum date-time for scheduler (current time + 1 minute)
     * @returns Formatted date-time string (YYYY-MM-DDTHH:MM)
     */
    const getMinDateTime = () => {
        const now = new Date();
        now.setMinutes(now.getMinutes() + 1); // Add 1 minute buffer
        return now.toISOString().slice(0, 16); // Format as YYYY-MM-DDTHH:MM
    };

    /**
     * Helper for authenticated fetch requests
     * Automatically adds authorization header with user token
     */
    const authFetch = async (url: string, options: RequestInit = {}) => {
        try {
            const headers = {
                ...options.headers,
                'Authorization': `Bearer ${userInfo?.token || ''}`,
            };

            return fetch(url, {
                ...options,
                headers,
            });
        } catch (error) {
            console.error('Network error during fetch:', error);
            throw new Error('Network error occurred. Please check your connection.');
        }
    };

    /**
     * Fetch scheduled messages from the backend
     * Used for initial load and refresh operations
     */
    const fetchScheduledMessages = useCallback(async () => {
        try {
            setRefreshing(true);
            const response = await authFetch(`${backendUrl}/api/scheduled-messages`);

            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
            }

            const data = await response.json();
            setScheduledMessages(data);
        } catch (error) {
            console.error('Failed to fetch scheduled messages', error);
            setSnackbar({
                open: true,
                message: 'Failed to load scheduled messages. Please try again.',
                severity: 'error'
            });
        } finally {
            setRefreshing(false);
        }
    }, [backendUrl, userInfo]);

    // Initial data loading effect
    useEffect(() => {
        const fetchChannels = async () => {
            try {
                const response = await authFetch(`${backendUrl}/api/channels`);

                if (!response.ok) {
                    throw new Error(`Server responded with status: ${response.status}`);
                }

                const data = await response.json();
                setChannels(data);

                if (data.length > 0) {
                    setSelectedChannel(data[0].id);
                }

                await fetchScheduledMessages();
            } catch (error) {
                console.error('Failed to fetch channels', error);
                setSnackbar({
                    open: true,
                    message: 'Failed to load channels. Please try refreshing.',
                    severity: 'error'
                });
            } finally {
                setLoading(false);
            }
        };

        fetchChannels();
    }, [backendUrl, fetchScheduledMessages, userInfo]);

    // Polling effect to refresh scheduled messages every 30 seconds
    useEffect(() => {
        // Initial fetch
        fetchScheduledMessages();

        // Set up polling interval
        const intervalId = setInterval(() => {
            fetchScheduledMessages();
        }, 30000); // 30 seconds

        // Clean up on unmount
        return () => clearInterval(intervalId);
    }, [fetchScheduledMessages]);

    /**
     * Handle sending a message immediately
     */
    const handleSendNow = async () => {
        if (!selectedChannel || !message) return;

        try {
            setLoading(true);
            const response = await authFetch(`${backendUrl}/api/send-message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channelId: selectedChannel,
                    message,
                    sendAsUser: sendAsUser
                }),
            });

            if (response.ok) {
                setSnackbar({
                    open: true,
                    message: 'Message sent successfully!',
                    severity: 'success'
                });
                setMessage('');
            } else {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to send message');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            setSnackbar({
                open: true,
                message: error instanceof Error ? error.message : 'Error sending message.',
                severity: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    /**
     * Handle scheduling a message for future delivery
     */
    const handleSchedule = async () => {
        if (!selectedChannel || !message || !scheduleDate) return;

        try {
            setLoading(true);
            const response = await authFetch(`${backendUrl}/api/schedule-message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channelId: selectedChannel,
                    message,
                    sendAt: scheduleDate,
                    sendAsUser: sendAsUser
                }),
            });

            if (response.ok) {
                setSnackbar({
                    open: true,
                    message: 'Message scheduled successfully!',
                    severity: 'success'
                });
                setMessage('');
                setScheduleDate('');
                fetchScheduledMessages(); // Refresh list after scheduling
            } else {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to schedule message');
            }
        } catch (error) {
            console.error('Error scheduling message:', error);
            setSnackbar({
                open: true,
                message: error instanceof Error ? error.message : 'Error scheduling message.',
                severity: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    /**
     * Handle cancellation of a scheduled message
     * @param id ID of the message to cancel
     */
    const handleCancelMessage = async (id: string) => {
        if (!window.confirm('Are you sure you want to cancel this scheduled message?')) return;

        try {
            const response = await authFetch(`${backendUrl}/api/scheduled-messages/${id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                // Update local state immediately instead of fetching again
                setScheduledMessages(prevMessages =>
                    prevMessages.filter(msg => msg.id !== id)
                );
                setSnackbar({
                    open: true,
                    message: 'Message cancelled successfully!',
                    severity: 'success'
                });
            } else {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to cancel message');
            }
        } catch (error) {
            console.error('Error cancelling message:', error);
            setSnackbar({
                open: true,
                message: error instanceof Error ? error.message : 'Error cancelling message.',
                severity: 'error'
            });
        }
    };

    /**
     * Manually refresh the scheduled messages list
     */
    const handleRefresh = () => {
        fetchScheduledMessages();
    };

    /**
     * Check if a message scheduled time has already passed
     * @param sendAt ISO date string of scheduled time
     * @returns boolean indicating if message is due/past
     */
    const isMessageDue = (sendAt: string) => {
        const sendTime = new Date(sendAt).getTime();
        const now = new Date().getTime();
        return sendTime <= now;
    };

    // Filter out messages that are past due (should have been sent)
    // This provides immediate UI feedback without waiting for the next poll
    const pendingMessages = scheduledMessages.filter(msg => !isMessageDue(msg.sendAt));

    // Calculate dashboard stats
    const scheduledCount = pendingMessages.length;
    const nextScheduled = pendingMessages.length > 0
        ? new Date(Math.min(...pendingMessages.map(msg => new Date(msg.sendAt).getTime())))
        : null;

    // Get the selected channel name for display
    const selectedChannelName = channels.find(ch => ch.id === selectedChannel)?.name || '';

    // Show loading state when first loading the channels
    if (loading && channels.length === 0) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
            {/* Stats row */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', mx: -1.5, mb: 3 }}>
                {/* Scheduled Messages Stat */}
                <Box sx={{ width: { xs: '100%', md: '50%', lg: '25%' }, px: 1.5, mb: 3 }}>
                    <Card elevation={2}>
                        <CardContent sx={{ display: 'flex', alignItems: 'center', p: 2 }}>
                            <Box sx={{
                                backgroundColor: 'primary.light',
                                borderRadius: '50%',
                                p: 1.5,
                                mr: 2,
                                display: 'flex'
                            }}>
                                <AccessTimeIcon sx={{ color: 'primary.main' }} />
                            </Box>
                            <Box>
                                <Typography variant="body2" color="text.secondary">
                                    Scheduled Messages
                                </Typography>
                                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                                    {scheduledCount}
                                </Typography>
                            </Box>
                        </CardContent>
                    </Card>
                </Box>

                {/* Next Scheduled Stat */}
                <Box sx={{ width: { xs: '100%', md: '50%', lg: '25%' }, px: 1.5, mb: 3 }}>
                    <Card elevation={2}>
                        <CardContent sx={{ display: 'flex', alignItems: 'center', p: 2 }}>
                            <Box sx={{
                                backgroundColor: 'success.light',
                                borderRadius: '50%',
                                p: 1.5,
                                mr: 2,
                                display: 'flex'
                            }}>
                                <AlarmIcon sx={{ color: 'success.main' }} />
                            </Box>
                            <Box>
                                <Typography variant="body2" color="text.secondary">
                                    Next Scheduled
                                </Typography>
                                <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                                    {nextScheduled
                                        ? nextScheduled.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                                        : 'None'}
                                </Typography>
                            </Box>
                        </CardContent>
                    </Card>
                </Box>

                {/* Available Channels Stat */}
                <Box sx={{ width: { xs: '100%', md: '50%', lg: '25%' }, px: 1.5, mb: 3 }}>
                    <Card elevation={2}>
                        <CardContent sx={{ display: 'flex', alignItems: 'center', p: 2 }}>
                            <Box sx={{
                                backgroundColor: 'info.light',
                                borderRadius: '50%',
                                p: 1.5,
                                mr: 2,
                                display: 'flex'
                            }}>
                                <CheckCircleOutlineIcon sx={{ color: 'info.main' }} />
                            </Box>
                            <Box>
                                <Typography variant="body2" color="text.secondary">
                                    Available Channels
                                </Typography>
                                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                                    {channels.length}
                                </Typography>
                            </Box>
                        </CardContent>
                    </Card>
                </Box>
            </Box>

            {/* Main Content */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', mx: -2 }}>
                {/* Left Side: Message Form */}
                <Box sx={{ width: { xs: '100%', lg: '41.67%' }, px: 2, mb: { xs: 4, lg: 0 } }}>
                    <Paper
                        elevation={2}
                        sx={{
                            p: 3,
                            borderRadius: 2,
                            height: '100%',
                            background: 'linear-gradient(180deg, #fff 0%, #f9f9f9 100%)'
                        }}
                    >
                        <Typography variant="h5" gutterBottom fontWeight="bold" color="primary.main">
                            Compose Message
                        </Typography>
                        <Divider sx={{ mb: 3 }} />

                        <FormControl fullWidth sx={{ mb: 3 }}>
                            <InputLabel id="channel-select-label">Channel</InputLabel>
                            <Select
                                labelId="channel-select-label"
                                value={selectedChannel}
                                label="Channel"
                                onChange={(e: SelectChangeEvent) => setSelectedChannel(e.target.value)}
                            >
                                {channels.map((channel) => (
                                    <MenuItem key={channel.id} value={channel.id}>
                                        #{channel.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle2" gutterBottom color="text.secondary">
                                Message Content
                            </Typography>
                            <TextField
                                multiline
                                rows={6}
                                fullWidth
                                placeholder="Type your message here..."
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                variant="outlined"
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        backgroundColor: '#fff'
                                    }
                                }}
                            />
                        </Box>

                        <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle2" gutterBottom color="text.secondary">
                                Schedule (Optional)
                            </Typography>
                            <TextField
                                type="datetime-local"
                                fullWidth
                                value={scheduleDate}
                                onChange={(e) => setScheduleDate(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                inputProps={{ min: getMinDateTime() }}
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        backgroundColor: '#fff'
                                    }
                                }}
                            />
                        </Box>

                        <FormControlLabel
                            control={
                                <Switch
                                    checked={sendAsUser}
                                    onChange={(e) => setSendAsUser(e.target.checked)}
                                    color="primary"
                                />
                            }
                            label="Send as myself (instead of as the bot)"
                            sx={{ mb: 3, display: 'block' }}
                        />

                        <Box sx={{
                            display: 'flex',
                            gap: 2,
                            justifyContent: 'space-between'
                        }}>
                            <Button
                                variant="contained"
                                onClick={handleSendNow}
                                disabled={!message || !selectedChannel || loading}
                                startIcon={<SendIcon />}
                                sx={{
                                    flexGrow: 1,
                                    py: 1.5,
                                    bgcolor: 'primary.main',
                                    '&:hover': {
                                        bgcolor: 'primary.dark',
                                    }
                                }}
                            >
                                Send Now
                            </Button>
                            <Button
                                variant="outlined"
                                onClick={handleSchedule}
                                disabled={!message || !scheduleDate || !selectedChannel || loading}
                                startIcon={<AccessTimeIcon />}
                                sx={{
                                    flexGrow: 1,
                                    py: 1.5
                                }}
                            >
                                Schedule
                            </Button>
                        </Box>

                        {selectedChannel && (
                            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                                <Chip
                                    label={`Sending to #${selectedChannelName}`}
                                    variant="outlined"
                                    size="small"
                                    color="primary"
                                />
                            </Box>
                        )}
                    </Paper>
                </Box>

                {/* Right Side: Scheduled Messages List */}
                <Box sx={{ width: { xs: '100%', lg: '58.33%' }, px: 2 }}>
                    <Paper
                        elevation={2}
                        sx={{
                            p: 3,
                            borderRadius: 2,
                            minHeight: '500px',
                            background: 'linear-gradient(180deg, #fff 0%, #f9f9f9 100%)'
                        }}
                    >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h5" fontWeight="bold" color="primary.main">
                                Scheduled Messages
                            </Typography>
                            <Tooltip title="Refresh">
                                <IconButton onClick={handleRefresh} disabled={refreshing}>
                                    {refreshing ? <CircularProgress size={24} /> : <RefreshIcon />}
                                </IconButton>
                            </Tooltip>
                        </Box>
                        <Divider sx={{ mb: 3 }} />

                        {/* Pass filtered messages instead of all messages */}
                        <ScheduledMessagesList
                            messages={pendingMessages}
                            onCancel={handleCancelMessage}
                            channels={channels}
                        />
                    </Paper>
                </Box>
            </Box>

            {/* Snackbar for notifications */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                    severity={snackbar.severity}
                    variant="filled"
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Container>
    );
};

export default DashboardPage;