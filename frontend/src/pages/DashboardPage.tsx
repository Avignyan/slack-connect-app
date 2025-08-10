import { useState, useEffect, useCallback } from 'react';
import {
    Container, Typography, Box, Select, MenuItem, TextField,
    Button, FormControl, InputLabel, CircularProgress, Switch, FormControlLabel
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import ScheduledMessagesList from '../components/ScheduledMessagesList';

// Define types for our data structures
type SlackChannel = { id: string; name: string };
type ScheduledMessage = { id: string; channelId: string; message: string; sendAt: string };

const DashboardPage = () => {
    const backendUrl = 'https://avigyan-slack-scheduler.loca.lt';

    const [channels, setChannels] = useState<SlackChannel[]>([]);
    const [selectedChannel, setSelectedChannel] = useState('');
    const [message, setMessage] = useState('');
    const [scheduleDate, setScheduleDate] = useState('');
    const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [sendAsUser, setSendAsUser] = useState(false);

    const fetchScheduledMessages = useCallback(async () => {
        try {
            const response = await fetch(`${backendUrl}/api/scheduled-messages`);
            if (response.ok) {
                const data = await response.json();
                setScheduledMessages(data);
            }
        } catch (error) { console.error('Failed to fetch scheduled messages', error); }
    }, [backendUrl]);

    useEffect(() => {
        const fetchChannels = async () => {
            try {
                const response = await fetch(`${backendUrl}/api/channels`);
                const data = await response.json();
                if (response.ok) {
                    setChannels(data);
                    if (data.length > 0) {
                        setSelectedChannel(data[0].id);
                    }
                    await fetchScheduledMessages();
                }
            } catch (error) {
                console.error('Failed to fetch channels', error);
            } finally {
                setLoading(false);
            }
        };
        fetchChannels();
    }, [backendUrl, fetchScheduledMessages]);

    const handleSendNow = async () => {
        if (!selectedChannel || !message) return;
        try {
            const response = await fetch(`${backendUrl}/api/send-message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channelId: selectedChannel,
                    message,
                    sendAsUser: sendAsUser
                }),
            });
            if (response.ok) {
                alert('Message sent successfully!');
                setMessage('');
            } else { alert('Failed to send message.'); }
        } catch (error) { console.error('Error sending message:', error); }
    };

    const handleSchedule = async () => {
        if (!selectedChannel || !message || !scheduleDate) return;
        try {
            const response = await fetch(`${backendUrl}/api/schedule-message`, {
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
                alert('Message scheduled successfully!');
                setMessage('');
                setScheduleDate('');
                fetchScheduledMessages();
            } else { alert('Failed to schedule message.'); }
        } catch (error) { console.error('Error scheduling message:', error); }
    };

    const handleCancelMessage = async (id: string) => {
        if (!window.confirm('Are you sure you want to cancel this scheduled message?')) return;
        try {
            const response = await fetch(`${backendUrl}/api/scheduled-messages/${id}`, {
                method: 'DELETE',
            });
            if (response.ok) {
                alert('Message cancelled successfully!');
                fetchScheduledMessages();
            } else { alert('Failed to cancel message.'); }
        } catch (error) { console.error('Error cancelling message:', error); }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ mt: 4 }}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 4 }}>
                {/* Left Side: Message Form */}
                <Box sx={{ width: { xs: '100%', md: '41.666%' } }}>
                    <Box sx={{ p: 3, bgcolor: 'white', borderRadius: 2, boxShadow: 1 }}>
                        <Typography variant="h5" gutterBottom>Compose Message</Typography>
                        <FormControl fullWidth sx={{ mb: 2 }}>
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
                        <TextField
                            label="Message"
                            multiline
                            rows={6}
                            fullWidth
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            sx={{ mb: 2 }}
                        />
                        <TextField
                            type="datetime-local"
                            label="Schedule for later"
                            fullWidth
                            value={scheduleDate}
                            onChange={(e) => setScheduleDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            sx={{ mb: 2 }}
                        />
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={sendAsUser}
                                    onChange={(e) => setSendAsUser(e.target.checked)}
                                />
                            }
                            label="Send as myself (instead of as the bot)"
                            sx={{ mb: 2, display: 'block' }}
                        />
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button variant="contained" onClick={handleSendNow} disabled={!message || !selectedChannel} fullWidth>Send Now</Button>
                            <Button variant="outlined" onClick={handleSchedule} disabled={!message || !scheduleDate || !selectedChannel} fullWidth>Schedule</Button>
                        </Box>
                    </Box>
                </Box>
                {/* Right Side: Scheduled Messages List */}
                <Box sx={{ width: { xs: '100%', md: '58.333%' } }}>
                    <ScheduledMessagesList messages={scheduledMessages} onCancel={handleCancelMessage} />
                </Box>
            </Box>
        </Container>
    );
};

export default DashboardPage;