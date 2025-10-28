import { useCookie } from "~/hooks/useCookie";
import useAuthSession from "../AuthSessionContextProvider";
import { PrimaryButton } from "../styles";
import ElectionStateWarning from "./ElectionStateWarning"
import useElection from "../ElectionContextProvider";
import { sharedConfig } from "@equal-vote/star-vote-shared/config";

export default () => {
    const authSession = useAuthSession();
    const [tempID] = useCookie('temp_id', '0');
    const [_, setElectionToClaim] = useCookie('election_to_claim', '');
    const {election, t} = useElection();

    const hoursSinceCreate = (new Date().getTime() - new Date(election.create_date).getTime()) / (1000 * 60 * 60)
    if(authSession.isLoggedIn() || election.owner_id != tempID || hoursSinceCreate > sharedConfig.TEMPORARY_ACCESS_HOURS) return <></>

    return (
        <ElectionStateWarning
            state='draft'
            title="temporary_access_warning.title"
            description="temporary_access_warning.description"
        >
            <PrimaryButton onClick={async () => {
                setElectionToClaim(election.election_id)
                authSession.openLogin()
            }} sx={{width: 242, m: 'auto'}}>{t('nav.sign_in')}</PrimaryButton>
        </ElectionStateWarning>
    );
}