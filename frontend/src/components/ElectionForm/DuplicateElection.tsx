import React from 'react'
import { useParams } from "react-router";
import Container from '@mui/material/Container';
import ElectionForm from "./ElectionForm";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router"
import { useGetElection, usePostElection } from '../../hooks/useAPI';

const DuplicateElection = ({ authSession }) => {
    const navigate = useNavigate()
    const { id } = useParams();

    const [data, setData] = useState(null);

    let { data: prevData, isPending, error, makeRequest: fetchElection } = useGetElection(id);
    const { isPending: postIsPending, error: postError, makeRequest: postElection } = usePostElection()
    useEffect(() => {
        fetchElection()
    }, [])
    
    useEffect(
        () => {
            if (prevData && prevData.election) {
                setData({ ...prevData, election: { ...prevData.election, title: `Copy of ${prevData.election.title}` } });
            }
        }, [prevData]
    )

    const onCreateElection = async (election) => {
        // calls post election api, throws error if response not ok
        const newElection = await postElection(
            {
                Election: election,
            })
        if ((!newElection)) {
            throw Error("Error submitting election");
        }
        
        localStorage.removeItem('Election')
        navigate(`/Election/${newElection.election.election_id}`)
    }

    return (
        <Container >
            {isPending && <div> Loading Election... </div>}
            {!authSession.isLoggedIn() && <div> Must be logged in to create elections </div>}
            {authSession.isLoggedIn() && data && data.election &&
                <ElectionForm authSession={authSession} onSubmitElection={onCreateElection} prevElectionData={data.election} submitText='Create Election' disableSubmit={postIsPending}/>
            }
            {postIsPending && <div> Submitting... </div>}
            {postError && <div> {postError} </div>}
        </Container>
    )
}

export default DuplicateElection 
