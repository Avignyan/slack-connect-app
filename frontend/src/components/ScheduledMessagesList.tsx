// frontend/src/components/ScheduledMessagesList.tsx

// Define the shape of a scheduled message object
type ScheduledMessage = {
    id: string;
    channelId: string;
    message: string;
    sendAt: string;
};

// Define the props that this component will accept
type ScheduledMessagesListProps = {
    messages: ScheduledMessage[];
    onCancel: (id: string) => void; // A function to handle cancellation
};

const ScheduledMessagesList = ({ messages, onCancel }: ScheduledMessagesListProps) => {
    if (messages.length === 0) {
        return <p>No messages are currently scheduled.</p>;
    }

    return (
        <div className="scheduled-messages-container">
            <h2>Scheduled Messages</h2>
            <ul className="scheduled-messages-list">
                {messages.map((msg) => (
                    <li key={msg.id} className="scheduled-message-item">
                        <div className="message-details">
                            <p><strong>Channel:</strong> #{msg.channelId}</p>
                            <p><strong>Scheduled for:</strong> {new Date(msg.sendAt).toLocaleString()}</p>
                            <blockquote>{msg.message}</blockquote>
                        </div>
                        <button onClick={() => onCancel(msg.id)} className="cancel-button">
                            Cancel
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default ScheduledMessagesList;