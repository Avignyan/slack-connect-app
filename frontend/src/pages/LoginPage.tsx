// frontend/src/pages/LoginPage.tsx
import { Container, Typography, Box } from '@mui/material';

type LoginPageProps = {
    backendUrl: string;
};

const LoginPage = ({ backendUrl }: LoginPageProps) => {
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
                    Welcome to Slack Connect
                </Typography>
                <Typography variant="h6" color="text.secondary" paragraph>
                    Connect your workspace to send and schedule messages with ease.
                </Typography>
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
        </Container>
    );
};

export default LoginPage;