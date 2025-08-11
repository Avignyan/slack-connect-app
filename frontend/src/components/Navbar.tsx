// frontend/src/components/Navbar.tsx
import { AppBar, Toolbar, Typography, Box, Button, Chip, Avatar } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import appLogo from '../assets/logo.svg';

// Updated props to include teamName
type NavbarProps = {
    isConnected: boolean | null;
    onLogout: () => void;
    userName?: string;
    teamName?: string;  // Add this prop
    teamIcon?: string;  // Optional team icon
    userInfo?: any;     // Keep other props as needed
    backendUrl?: string;
    onWorkspaceSwitch?: (teamId: string) => void;
};

const Navbar = ({ isConnected, onLogout, userName, teamName, teamIcon,  }: NavbarProps) => {
    return (
        <AppBar
            position="static"
            elevation={1}
            sx={{ background: 'linear-gradient(90deg, #4A154B 0%, #6e48aa 50%, #b298dc 100%)' }}
        >
            <Toolbar sx={{ minHeight: 80 }}>
                <Box component="img" sx={{ height: 50, width: 50, mr: 2, borderRadius: '10px' }} alt="ConnectFlow Logo" src={appLogo} />
                <Typography variant="h5" component="div" sx={{ flexGrow: 1, color: '#ffffff', fontWeight: 'bold' }}>
                    ConnectFlow
                </Typography>

                {/* Display workspace name and icon if connected */}
                {isConnected && teamName && (
                    <Chip
                        avatar={teamIcon ? <Avatar src={teamIcon} /> : undefined}
                        label={teamName}
                        sx={{
                            mr: 2,
                            backgroundColor: 'rgba(255, 255, 255, 0.15)',
                            color: '#ffffff',
                            '& .MuiChip-label': {
                                fontWeight: 500
                            }
                        }}
                    />
                )}

                {/* Display the user name if connected */}
                {isConnected && userName && (
                    <Typography variant="subtitle1" sx={{ mr: 2, color: '#ffffff' }}>
                        {userName}
                    </Typography>
                )}

                {/* Logout Button */}
                {isConnected && (
                    <Button
                        variant="contained"
                        color="error"
                        onClick={onLogout}
                        startIcon={<LogoutIcon />}
                        sx={{
                            fontWeight: 'bold',
                            minWidth: '100px'
                        }}
                    >
                        Logout
                    </Button>
                )}
            </Toolbar>
        </AppBar>
    );
};

export default Navbar;