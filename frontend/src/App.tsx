import { useState, useEffect, useCallback } from 'react';
import ScheduledMessagesList from './components/ScheduledMessagesList'; // Import the new component

// Define types at the top level
type SlackChannel = {
    id: string;
    name: string;
};

type ScheduledMessage = {
    id: string;
    channelId: string;
    message: string;
    sendAt: string;
};

function App() {
    const backendUrl = 'https://avigyan-slack-scheduler.loca.lt';

    const [channels, setChannels] = useState<SlackChannel[]>([]);
    const [selectedChannel, setSelectedChannel] = useState('');
    const [message, setMessage] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [scheduleDate, setScheduleDate] = useState('');

    // Add new state for the list of scheduled messages
    const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);

    // Function to fetch scheduled messages
    const fetchScheduledMessages = useCallback(async () => {
        try {
            const response = await fetch(`${backendUrl}/api/scheduled-messages`);
            if (response.ok) {
                const data = await response.json();
                setScheduledMessages(data);
            }
        } catch (error) {
            console.error('Failed to fetch scheduled messages', error);
        }
    }, [backendUrl]);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const response = await fetch(`${backendUrl}/api/channels`);
                const data = await response.json();
                if (response.ok) {
                    setChannels(data);
                    setIsConnected(true);
                    if (data.length > 0) {
                        setSelectedChannel(data[0].id);
                    }
                    // After fetching channels, also fetch scheduled messages
                    fetchScheduledMessages();
                } else {
                    setIsConnected(false);
                }
            } catch (error) {
                console.error('Failed to fetch channels', error);
                setIsConnected(false);
            }
        };
        fetchInitialData();
    }, [backendUrl, fetchScheduledMessages]);

    const handleSendNow = async () => {
        if (!selectedChannel || !message) return;
        try {
            const response = await fetch(`${backendUrl}/api/send-message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channelId: selectedChannel, message }),
            });
            if (response.ok) {
                alert('Message sent successfully!');
                setMessage('');
            } else {
                const errorData = await response.json();
                alert(`Failed to send message: ${errorData.error}`);
            }
        } catch (error) {
            console.error('Error sending message:', error);
            alert('An error occurred while sending the message.');
        }
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
                }),
            });

            if (response.ok) {
                alert('Message scheduled successfully!');
                setMessage('');
                setScheduleDate('');
                // Refresh the list after scheduling a new message
                fetchScheduledMessages();
            } else {
                const errorData = await response.json();
                alert(`Failed to schedule message: ${errorData.error}`);
            }
        } catch (error) {
            console.error('Error scheduling message:', error);
            alert('An error occurred while scheduling the message.');
        }
    };

    // Function to handle cancelling a message
    const handleCancelMessage = async (id: string) => {
        if (!window.confirm('Are you sure you want to cancel this scheduled message?')) {
            return;
        }
        try {
            const response = await fetch(`${backendUrl}/api/scheduled-messages/${id}`, {
                method: 'DELETE',
            });
            if (response.ok) {
                alert('Message cancelled successfully!');
                // Refresh the list after cancelling
                fetchScheduledMessages();
            } else {
                alert('Failed to cancel message.');
            }
        } catch (error) {
            console.error('Error cancelling message:', error);
            alert('An error occurred while cancelling the message.');
        }
    };

    if (!isConnected) {
        return (
            <div className="container">
                <header>
                    <h1>Slack Connect</h1>
                    <p>Connect your workspace to send and schedule messages.</p>
                    <a href={`${backendUrl}/slack/install`}>
                        <img
                            alt="Add to Slack"
                            height="40"
                            width="139"
                            src="https://platform.slack-edge.com/img/add_to_slack.png"
                            srcSet="https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x"
                        />
                    </a>
                </header>
            </div>
        );
    }

    return (
        <div className="container">
            <h1>Send a Slack Message</h1>
            <div className="form-group">
                <label htmlFor="channel-select">Channel:</label>
                <select
                    id="channel-select"
                    value={selectedChannel}
                    onChange={(e) => setSelectedChannel(e.target.value)}
                >
                    {channels.map((channel) => (
                        <option key={channel.id} value={channel.id}>
                            #{channel.name}
                        </option>
                    ))}
                </select>
            </div>
            <div className="form-group">
                <label htmlFor="message-input">Message:</label>
                <textarea
                    id="message-input"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    placeholder="Compose your message..."
                />
            </div>

            <div className="form-group">
                <label htmlFor="schedule-date">Schedule for later:</label>
                <input
                    type="datetime-local"
                    id="schedule-date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                />
            </div>

            <div className="button-group">
                <button onClick={handleSendNow} disabled={!selectedChannel || !message}>
                    Send Now
                </button>
                <button
                    onClick={handleSchedule}
                    disabled={!selectedChannel || !message || !scheduleDate}
                    className="secondary"
                >
                    Schedule
                </button>
            </div>

            {/* Render the new component below the form */}
            <hr />
            <ScheduledMessagesList messages={scheduledMessages} onCancel={handleCancelMessage} />
        </div>
    );
}

export default App;