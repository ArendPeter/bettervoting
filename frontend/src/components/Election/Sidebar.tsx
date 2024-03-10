import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Button, Grid } from '@mui/material';
import { Link } from 'react-router-dom';
import { Paper } from '@mui/material';
import PermissionHandler from '../PermissionHandler';
import useElection from '../ElectionContextProvider';
import useFeatureFlags from '../FeatureFlagContextProvider';

const ListItem = ({ text, link }) => {
    return (
        <Grid item>
            <Button component={Link} to={link} fullWidth >
                <Typography align='center' gutterBottom variant="h6" component="h6">
                    {text}
                </Typography>
            </Button>
        </Grid>
    )
}

export default function Sidebar() {
    
    const { election, voterAuth, permissions } = useElection()
    const id = election.election_id;
    const flags = useFeatureFlags();
    return (
        <>
            {voterAuth?.roles?.length > 0 &&
                <Box
                    display='flex'
                    justifyContent="center"
                    flexGrow='1'
                    alignItems="center"
                    sx={{ width: '100%' }}>
                    <Paper elevation={3} sx={{ width: 600 }} >
                        <Grid container direction="column" >
                            <ListItem text='Voting Page' link={`/Election/${id}/`} />
                            <ListItem text='Admin Home' link={`/Election/${id}/admin`} />
                            {election.state === 'draft' &&
                                <>
                                    {flags.isSet('ELECTION_ROLES') &&
                                        <PermissionHandler permissions={permissions} requiredPermission={'canEditElectionRoles'}>
                                            <ListItem text='Edit Election Roles' link={`/Election/${id}/admin/roles`} />
                                        </PermissionHandler>
                                    }
                                </>}
                            {election.settings.voter_access != 'open' && <PermissionHandler permissions={permissions} requiredPermission={'canViewElectionRoll'}>
                                <ListItem text='Voters' link={`/Election/${id}/admin/voters`} />
                            </PermissionHandler>}
                            <PermissionHandler permissions={permissions} requiredPermission={'canViewBallots'}>
                                <ListItem text='Ballots' link={`/Election/${id}/admin/ballots`} />
                            </PermissionHandler>
                        </Grid>
                    </Paper>
                </Box>
            }
        </>
    );
}
