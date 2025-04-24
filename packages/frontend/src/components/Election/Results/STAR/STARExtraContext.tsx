import { starResults } from "@equal-vote/star-vote-shared/domain_model/ITabulators";
import { Paper, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";


const STARExtraContext = ({ results, roundIndex }: {results: starResults, roundIndex: number}) => {
    const { t } = useTranslation();
    const width = 'auto';
    const winnerIndex = results.roundResults[roundIndex].winners[0].index;
    const runnerUpIndex = results.roundResults[roundIndex].runner_up[0].index;
    if (results.summaryData.totalScores[winnerIndex].score < results.summaryData.totalScores[runnerUpIndex].score) {
        return (
            <Paper elevation={4} sx={{ width: width, margin: 'auto', textAlign: 'left', padding: 3, marginTop: 2 }}>
                <b>{t('results.star.score_higher_than_runoff_title')}</b>
                <hr />
                <Typography>
                    {t('results.star.score_higher_than_runoff_text')}
                </Typography>
            </Paper>
        );
    }

    return null; // Return null if the condition is not met
}

export default STARExtraContext;