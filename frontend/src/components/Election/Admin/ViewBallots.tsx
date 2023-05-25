import { useEffect, useState } from "react"
import useFetch from "../../../hooks/useFetch";
import { useParams } from "react-router";
import React from 'react'
import Button from "@mui/material/Button";
import Container from '@mui/material/Container';
import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from "@mui/material";
import PermissionHandler from "../../PermissionHandler";
import ViewBallot from "./ViewBallot";
import { CSVLink, CSVDownload } from "react-csv";

const ViewBallots = ({ election, permissions }) => {
    const { id } = useParams();
    const { data, isPending, error, makeRequest: fetchBallots } = useFetch(`/API/Election/${id}/ballots`, 'get')
    useEffect(() => { fetchBallots() }, [])
    const [isViewing, setIsViewing] = useState(false)
    const [addRollPage, setAddRollPage] = useState(false)
    const [selectedBallot, setSelectedBallot] = useState(null)

    const onOpen = (ballot) => {
        setIsViewing(true)
        setSelectedBallot({ ...ballot })
    }
    const onClose = (roll) => {
        setIsViewing(false)
        setAddRollPage(false)
        setSelectedBallot(null)
        fetchBallots()
    }
    const getDateString = (dateNum) => {
        const event = new Date(dateNum);
        return event.toLocaleString();
    }

    const csvData = [
        ["firstname", "lastname", "email"],
        ["Ahmed", "Tomi", "ah@smthing.co.com"],
        ["Raed", "Labes", "rl@smthing.co.com"],
        ["Yezzi", "Min l3b", "ymin@cocococo.com"]
      ];

    return (
        <Container>
            <Typography align='center' gutterBottom variant="h4" component="h4">
                {election.title}
            </Typography>
            <Typography align='center' gutterBottom variant="h5" component="h5">
                View Ballots
            </Typography>
            {isPending && <div> Loading Data... </div>}
            {data && data.ballots && !isViewing && !addRollPage &&
            
                <TableContainer component={Paper}>
                    <Table style={{ width: '100%' }} aria-label="simple table">
                        <TableHead>
                            <TableCell> ID </TableCell>
                            <TableCell> Precinct </TableCell>
                            <TableCell> Date Submitted </TableCell>
                            <TableCell> Status </TableCell>
                            {election.races.map((race) => (
                                race.candidates.map((candidate) => (
                                    <TableCell>
                                        {candidate.candidate_name}
                                    </TableCell>
                                ))
                            ))}
                            <TableCell> View </TableCell>
                        </TableHead>
                        <TableBody>
                            {data.ballots.map((ballot) => (
                                <TableRow key={ballot.ballot_id} >
                                    <TableCell component="th" scope="row">{ballot.ballot_id}</TableCell>
                                    <TableCell >{ballot.precinct || ''}</TableCell>
                                    <TableCell >{getDateString(Number(ballot.date_submitted))}</TableCell>
                                    <TableCell >{ballot.status.toString()}</TableCell>
                                    {ballot.votes.map((vote) => (
                                        vote.scores.map((score) => (
                                            <TableCell >{score.score || ''}</TableCell>
                                        ))))}
                                    <TableCell ><Button variant='outlined' onClick={() => onOpen(ballot)} > View </Button></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
                && 
                <CSVDownload data={csvData} target="_blank" />
            }
            {isViewing && selectedBallot &&
                <ViewBallot election={election} ballot={selectedBallot} onClose={onClose} fetchBallot={fetchBallots} permissions={permissions} />
            }
        </Container>
    )
}

export default ViewBallots
