// frontend/src/components/Navbar.tsx
import { AppBar, Toolbar, Typography, Box, IconButton } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import appLogo from '../assets/logo.png';

// Define the props the Navbar will accept
type NavbarProps = {
    isConnected: boolean | null;
    onLogout: () => void;
};

const Navbar = ({ isConnected, onLogout }: NavbarProps) => {
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
                {/* Conditionally render the logout button */}
                {isConnected && (
                    <IconButton color="inherit" onClick={onLogout} title="Logout">
                        <LogoutIcon />
                    </IconButton>
                )}
            </Toolbar>
        </AppBar>
    );
};

export default Navbar;