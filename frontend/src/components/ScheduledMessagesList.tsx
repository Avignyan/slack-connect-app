import { Box, Typography, List, Button, Chip, Card, CardContent } from '@mui/material';
import ScheduleIcon from '@mui/icons-material/Schedule';
import DeleteIcon from '@mui/icons-material/Delete';
import TagIcon from '@mui/icons-material/Tag';
import { useEffect, useState } from 'react';

// Define the shape of a scheduled message object
type ScheduledMessage = {
    id: string;
    channelId: string;
    message: string;
    sendAt: string;
    status?: string;
};

type SlackChannel = {
    id: string;
    name: string;
};

// Define the props that this component will accept
type ScheduledMessagesListProps = {
    messages: ScheduledMessage[];
    onCancel: (id: string) => void; // A function to handle cancellation
    channels: SlackChannel[]; // Add channels prop
};

const ScheduledMessagesList = ({ messages, onCancel, channels }: ScheduledMessagesListProps) => {
    const [timeRemaining, setTimeRemaining] = useState<Record<string, string>>({});

    // Format the date in a user-friendly way
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short'
        }).format(date);
    };

    // Calculate time remaining for a given date
    const calculateTimeRemaining = (dateString: string): string => {
        const now = new Date();
        const sendAt = new Date(dateString);
        const diffMs = sendAt.getTime() - now.getTime();

        if (diffMs <= 0) return 'Sending...';

        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} from now`;
        if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} from now`;
        if (diffMins > 0) return `${diffMins} minute${diffMins > 1 ? 's' : ''} from now`;
        return `${diffSecs} second${diffSecs > 1 ? 's' : ''} from now`;
    };

    // Update time remaining every second
    useEffect(() => {
        // Calculate initial time remaining
        const initialTimeRemaining: Record<string, string> = {};
        messages.forEach(msg => {
            initialTimeRemaining[msg.id] = calculateTimeRemaining(msg.sendAt);
        });
        setTimeRemaining(initialTimeRemaining);

        // Set up interval to update times
        const intervalId = setInterval(() => {
            setTimeRemaining(prev => {
                const updated = { ...prev };
                messages.forEach(msg => {
                    updated[msg.id] = calculateTimeRemaining(msg.sendAt);
                });
                return updated;
            });
        }, 1000);

        return () => clearInterval(intervalId);
    }, [messages]);

    // Get channel name from id
    const getChannelName = (channelId: string): string => {
        return channels.find(ch => ch.id === channelId)?.name || channelId;
    };

    if (messages.length === 0) {
        return (
            <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                py: 8,
                textAlign: 'center',
                color: 'text.secondary',
                border: '1px dashed #ccc',
                borderRadius: 2,
            }}>
                <ScheduleIcon sx={{ fontSize: 60, mb: 2, color: 'text.disabled' }} />
                <Typography variant="h6">No messages scheduled</Typography>
                <Typography variant="body2">
                    Messages you schedule will appear here
                </Typography>
            </Box>
        );
    }

    return (
        <Box>
            <List sx={{ p: 0 }}>
                {messages.map((msg) => (
                    <Card
                        key={msg.id}
                        sx={{
                            mb: 2,
                            border: '1px solid #e0e0e0',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            '&:hover': {
                                transform: 'translateY(-2px)',
                                boxShadow: 3
                            }
                        }}
                    >
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Chip
                                    icon={<TagIcon fontSize="small" />}
                                    label={`#${getChannelName(msg.channelId)}`}
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                />
                                <Chip
                                    icon={<ScheduleIcon fontSize="small" />}
                                    label={timeRemaining[msg.id] || 'Loading...'}
                                    size="small"
                                    color="secondary"
                                    variant="outlined"
                                />
                            </Box>

                            <Box sx={{
                                p: 2,
                                my: 2,
                                backgroundColor: '#f5f5f5',
                                borderRadius: 1,
                                maxHeight: '120px',
                                overflow: 'auto',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word'
                            }}>
                                <Typography variant="body2">
                                    {msg.message}
                                </Typography>
                            </Box>

                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="caption" color="text.secondary">
                                    Scheduled for: {formatDate(msg.sendAt)}
                                </Typography>
                                <Button
                                    variant="outlined"
                                    color="error"
                                    size="small"
                                    startIcon={<DeleteIcon />}
                                    onClick={() => onCancel(msg.id)}
                                >
                                    Cancel
                                </Button>
                            </Box>
                        </CardContent>
                    </Card>
                ))}
            </List>
        </Box>
    );
};

export default ScheduledMessagesList;