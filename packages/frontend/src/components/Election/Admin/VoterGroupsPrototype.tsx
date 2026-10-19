// PROTOTYPE: throwaway. Never merge to main.
// Question: how should configuring Voter Groups look and behave on the Settings page?
// (on/off toggle, editing the group list, race-by-group grid)
// Variants of the Voter Groups section, switchable via `?variant=D|A|B|C`, mounted on the
// existing /:id/admin/settings route. D is the merge of A's grid and C's "Edit groups" dialog,
// with warnings styled like skipped ranks on ranked ballots. All state is in memory: nothing is saved to the election.
//
// Data rules from "Shape and enforcement of the election's voter group list" (#1702):
//   race.precincts undefined = open to everyone, [] = open to no one (error), "" = the "No group" column.
import { useEffect, useMemo, useState } from 'react';
import {
    Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton,
    List, ListItemButton, ListItemText, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField,
    Tooltip, Typography, Autocomplete, FormHelperText,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import useElection from '~/components/ElectionContextProvider';
import { useGetRolls } from '~/hooks/useAPI';
import { SwitchSetting, useSubstitutedTranslation } from '~/components/util';
import PrototypeSwitcher, { PrototypeVariant, usePrototypeVariant } from '~/components/PrototypeSwitcher';

const NO_GROUP = '';
const VARIANTS: PrototypeVariant[] = [
    { key: 'D', name: 'Grid + Edit groups dialog' },
    { key: 'A', name: 'Inline grid' },
    { key: 'B', name: 'Group by group' },
    { key: 'C', name: 'Race by race + ballot preview' },
];

type ProtoRace = { race_id: string; title: string; precincts?: string[] };
type ProtoState = {
    enabled: boolean;
    groups: string[];
    races: ProtoRace[];
    counts: Record<string, number>; // voters per group; NO_GROUP = voters with no group
};

const label = (g: string) => g === NO_GROUP ? 'No group' : g;

// ---------- shared state + rules (the bit that would become real logic) ----------

function useProtoState(): [ProtoState, ProtoActions] {
    const { election } = useElection();
    const { data, error, makeRequest } = useGetRolls(election.election_id);
    useEffect(() => { makeRequest(); }, []);

    const [state, setState] = useState<ProtoState | null>(null);

    useEffect(() => {
        if (state || (!data && !error)) return;
        const roll = data?.electionRoll ?? [];
        const counts: Record<string, number> = {};
        roll.forEach(r => { const g = r.precinct?.trim() ?? NO_GROUP; counts[g] = (counts[g] ?? 0) + 1; });
        let groups = Object.keys(counts).filter(g => g !== NO_GROUP);
        let demo = false;
        if (groups.length === 0) {
            demo = true;
            groups = ['Ward 1', 'Ward 2', 'Ward 3'];
            Object.assign(counts, { 'Ward 1': 120, 'Ward 2': 85, 'Ward 3': 40, [NO_GROUP]: 12 });
        }
        const races: ProtoRace[] = election.races.map(r => ({
            race_id: r.race_id, title: r.title, precincts: r.precincts as string[] | undefined,
        }));
        // Pad small elections so the grid has something to show.
        const demoTitles = ['Ward 1 Council Seat', 'Ward 2 Council Seat', 'Ward 3 Council Seat', 'Ballot Measure A'];
        while (races.length < 4) {
            const t = demoTitles[races.length];
            races.push({ race_id: `demo-${races.length}`, title: `${t} (demo)` });
        }
        if (demo) {
            // Give the demo races a realistic starting mapping.
            races.forEach(r => {
                const m = r.title.match(/Ward (\d)/);
                if (r.race_id.startsWith('demo') && m) r.precincts = [`Ward ${m[1]}`];
            });
        }
        setState({ enabled: true, groups, races, counts });
    }, [data, error]);

    const s = state ?? { enabled: false, groups: [], races: [], counts: {} };
    const update = (f: (s: ProtoState) => ProtoState) => setState(prev => prev && f(prev));

    const actions: ProtoActions = {
        setEnabled: v => update(s => ({ ...s, enabled: v })),
        addGroup: raw => {
            const name = raw.trim();
            if (!name) return 'Group names can\'t be empty';
            if (s.groups.some(g => g.toLowerCase() === name.toLowerCase())) return `"${name}" is already a group`;
            // A new group starts ticked for every race; races open to everyone already include it.
            update(s => ({
                ...s,
                groups: [...s.groups, name],
                races: s.races.map(r => r.precincts ? { ...r, precincts: [...r.precincts, name] } : r),
            }));
            return null;
        },
        deleteGroup: g => {
            if ((s.counts[g] ?? 0) > 0) return `${s.counts[g]} voters belong to ${g}, so it can't be deleted`;
            update(s => ({
                ...s,
                groups: s.groups.filter(x => x !== g),
                races: s.races.map(r => r.precincts ? { ...r, precincts: r.precincts.filter(x => x !== g) } : r),
            }));
            return null;
        },
        setCell: (raceId, g, on) => update(s => ({
            ...s,
            races: s.races.map(r => {
                if (r.race_id !== raceId) return r;
                const current = r.precincts ?? allColumns(s);
                const next = on ? [...current, g] : current.filter(x => x !== g);
                return { ...r, precincts: next };
            }),
        })),
        setRaceGroups: (raceId, groups) => update(s => ({
            ...s, races: s.races.map(r => r.race_id === raceId ? { ...r, precincts: groups } : r),
        })),
        setEveryone: raceId => update(s => ({
            ...s, races: s.races.map(r => r.race_id === raceId ? { ...r, precincts: undefined } : r),
        })),
    };
    return [s, actions];
}

type ProtoActions = {
    setEnabled: (v: boolean) => void;
    addGroup: (name: string) => string | null; // returns an error message
    deleteGroup: (g: string) => string | null;
    setCell: (raceId: string, g: string, on: boolean) => void;
    setRaceGroups: (raceId: string, groups: string[]) => void;
    setEveryone: (raceId: string) => void;
};

const allColumns = (s: ProtoState) => [...s.groups, NO_GROUP];
const sees = (r: ProtoRace, g: string) => r.precincts === undefined || r.precincts.includes(g);
const racesFor = (s: ProtoState, g: string) => s.races.filter(r => sees(r, g));
const total = (s: ProtoState) => Object.values(s.counts).reduce((a, b) => a + b, 0);

// ---------- shared small pieces ----------

function GroupAdder({ actions, compact }: { actions: ProtoActions; compact?: boolean }) {
    const [v, setV] = useState('');
    const [err, setErr] = useState<string | null>(null);
    const submit = () => { const e = actions.addGroup(v); setErr(e); if (!e) setV(''); };
    return <Stack direction='row' sx={{ gap: 1, alignItems: 'flex-start' }}>
        <TextField size='small' label='New voter group' value={v} error={!!err} helperText={err}
            onChange={e => { setV(e.target.value); setErr(null); }}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }} sx={{ width: compact ? 180 : 260 }} />
        <Button variant='outlined' onClick={submit}>Add</Button>
    </Stack>;
}

function useDeleteWithMessage(actions: ProtoActions) {
    const [msg, setMsg] = useState<string | null>(null);
    return { msg, clear: () => setMsg(null), del: (g: string) => setMsg(actions.deleteGroup(g)) };
}

function StateDump({ s }: { s: ProtoState }) {
    const settings = { voter_groups_enabled: s.enabled, voter_groups: s.groups };
    const races = s.races.map(r => ({ title: r.title, precincts: r.precincts === undefined ? 'undefined' : r.precincts }));
    return <Box component='details' sx={{ mt: 3, mb: 10, fontFamily: 'monospace', fontSize: 12, bgcolor: '#f4f4f4', color: '#000', p: 1, borderRadius: 1 }}>
        <summary>PROTOTYPE state (what would be saved)</summary>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify({ settings, races, voter_counts: s.counts }, null, 2)}</pre>
    </Box>;
}

// ---------- Variant A: everything inline, one grid ----------

function VariantA({ s, actions }: { s: ProtoState; actions: ProtoActions }) {
    const { msg, clear, del } = useDeleteWithMessage(actions);
    const cols = allColumns(s);
    return <Box>
        {s.enabled && <>
            <Typography variant='subtitle1' sx={{ fontWeight: 600, mt: 2 }}>Groups</Typography>
            <Stack direction='row' sx={{ gap: 1, flexWrap: 'wrap', my: 1 }}>
                {s.groups.map(g => <Chip key={g} label={`${g} · ${s.counts[g] ?? 0}`} onDelete={() => del(g)} />)}
            </Stack>
            {msg && <Alert severity='warning' onClose={clear} sx={{ mb: 1 }}>{msg}</Alert>}
            <GroupAdder actions={actions} />

            <Typography variant='subtitle1' sx={{ fontWeight: 600, mt: 3 }}>Which races each group sees</Typography>
            <Box sx={{ overflowX: 'auto' }}>
                <Table size='small' sx={{ '& td, & th': { px: 1 } }}>
                    <TableHead>
                        <TableRow>
                            <TableCell>Race</TableCell>
                            {cols.map(g => {
                                const empty = racesFor(s, g).length === 0;
                                return <TableCell key={g} align='center' sx={{ bgcolor: empty ? 'warning.light' : undefined }}>
                                    <Tooltip title={empty ? `${label(g)} voters would see no races` : ''}>
                                        <Box>
                                            <Box sx={{ fontWeight: 600, fontStyle: g === NO_GROUP ? 'italic' : undefined }}>{label(g)}</Box>
                                            <Box sx={{ fontSize: 12, color: 'text.secondary' }}>{s.counts[g] ?? 0} voters</Box>
                                        </Box>
                                    </Tooltip>
                                </TableCell>;
                            })}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {s.races.map(r => {
                            const empty = r.precincts !== undefined && r.precincts.length === 0;
                            return <TableRow key={r.race_id} sx={{ bgcolor: empty ? 'error.light' : undefined }}>
                                <TableCell>
                                    {r.title}
                                    {empty && <Typography variant='caption' sx={{ display: 'block' }}>No group can see this race</Typography>}
                                </TableCell>
                                {cols.map(g => <TableCell key={g} align='center'>
                                    <Checkbox checked={sees(r, g)} onChange={e => actions.setCell(r.race_id, g, e.target.checked)}
                                        slotProps={{ input: { 'aria-label': `${r.title} / ${label(g)}` } }} />
                                </TableCell>)}
                            </TableRow>;
                        })}
                    </TableBody>
                </Table>
            </Box>
        </>}
    </Box>;
}

// ---------- Variant B: pick a group, see its ballot ----------

function VariantB({ s, actions }: { s: ProtoState; actions: ProtoActions }) {
    const { msg, clear, del } = useDeleteWithMessage(actions);
    const cols = allColumns(s);
    const [selected, setSelected] = useState<string>(cols[0]);
    const sel = cols.includes(selected) ? selected : cols[0];
    if (!s.enabled) return null;
    return <Paper variant='outlined' sx={{ mt: 2, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, minHeight: 320 }}>
        <Box sx={{ width: { sm: 240 }, borderRight: { sm: 1 }, borderColor: 'divider', p: 1 }}>
            <List dense>
                {cols.map(g => {
                    const n = racesFor(s, g).length;
                    return <ListItemButton key={g} selected={g === sel} onClick={() => setSelected(g)}>
                        <ListItemText
                            primary={<span style={{ fontStyle: g === NO_GROUP ? 'italic' : undefined }}>{label(g)}</span>}
                            secondary={`${s.counts[g] ?? 0} voters · ${n} of ${s.races.length} races`}
                            slotProps={{ secondary: { color: n === 0 ? 'error' : undefined } }} />
                        {g !== NO_GROUP && <IconButton size='small' edge='end' aria-label={`Delete ${g}`}
                            onClick={e => { e.stopPropagation(); del(g); }}><DeleteIcon fontSize='small' /></IconButton>}
                    </ListItemButton>;
                })}
            </List>
            <Divider sx={{ my: 1 }} />
            <GroupAdder actions={actions} compact />
            {msg && <Alert severity='warning' onClose={clear} sx={{ mt: 1 }}>{msg}</Alert>}
        </Box>
        <Box sx={{ flex: 1, p: 2 }}>
            <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
                Ballot for {label(sel)} voters
            </Typography>
            <Typography variant='body2' color='text.secondary' sx={{ mb: 1 }}>
                Tick the races these {s.counts[sel] ?? 0} voters will see. Races stay in ballot order.
            </Typography>
            {racesFor(s, sel).length === 0 && <Alert severity='warning' sx={{ mb: 1 }}>These voters would see no races.</Alert>}
            {s.races.map((r, i) => {
                const others = cols.filter(g => g !== sel && sees(r, g));
                const empty = r.precincts !== undefined && r.precincts.length === 0;
                return <Stack key={r.race_id} direction='row' sx={{ alignItems: 'center', borderBottom: 1, borderColor: 'divider', py: 0.5 }}>
                    <Checkbox checked={sees(r, sel)} onChange={e => actions.setCell(r.race_id, sel, e.target.checked)} />
                    <Box sx={{ flex: 1 }}>
                        <Typography>{i + 1}. {r.title}</Typography>
                        <Typography variant='caption' color={empty ? 'error' : 'text.secondary'}>
                            {r.precincts === undefined ? 'Everyone' :
                                empty ? 'No group can see this race' :
                                others.length ? `Also: ${others.map(label).join(', ')}` : `Only ${label(sel)}`}
                        </Typography>
                    </Box>
                </Stack>;
            })}
        </Box>
    </Paper>;
}

// ---------- Variant C: one row per race, groups as chips, plus distinct-ballot preview ----------

function VariantC({ s, actions }: { s: ProtoState; actions: ProtoActions }) {
    const [editing, setEditing] = useState(false);
    const cols = allColumns(s);

    // Simply Voting style: one preview per distinct set of races, not per group.
    const ballots = useMemo(() => {
        const byKey = new Map<string, { races: ProtoRace[]; groups: string[] }>();
        cols.forEach(g => {
            const rs = racesFor(s, g);
            const key = rs.map(r => r.race_id).join('|');
            if (!byKey.has(key)) byKey.set(key, { races: rs, groups: [] });
            byKey.get(key)!.groups.push(g);
        });
        return [...byKey.values()];
    }, [s]);

    if (!s.enabled) return null;
    return <Box sx={{ mt: 2 }}>
        <Stack direction='row' sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography>{s.groups.length} groups: {s.groups.join(', ')}</Typography>
            <Button size='small' onClick={() => setEditing(true)}>Edit groups</Button>
        </Stack>

        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 3, mt: 2 }}>
            <Box sx={{ flex: 3 }}>
                <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>Races</Typography>
                {s.races.map(r => {
                    const everyone = r.precincts === undefined;
                    const value = (r.precincts ?? []).map(String);
                    return <Box key={r.race_id} sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}>
                        <Typography sx={{ fontWeight: 500 }}>{r.title}</Typography>
                        {everyone
                            ? <Stack direction='row' sx={{ gap: 1, alignItems: 'center', mt: 0.5 }}>
                                <Chip label='Everyone' color='primary' size='small' />
                                <Button size='small' onClick={() => actions.setRaceGroups(r.race_id, [...cols])}>Limit to groups…</Button>
                            </Stack>
                            : <Stack direction='row' sx={{ gap: 1, alignItems: 'center', mt: 0.5 }}>
                                <Autocomplete multiple size='small' sx={{ flex: 1 }} options={cols} value={value}
                                    getOptionLabel={label}
                                    onChange={(_, v) => actions.setRaceGroups(r.race_id, v)}
                                    renderInput={p => <TextField {...p} placeholder='Groups'
                                        error={value.length === 0} helperText={value.length === 0 ? 'No group can see this race' : undefined} />} />
                                <Button size='small' onClick={() => actions.setEveryone(r.race_id)}>Everyone</Button>
                            </Stack>}
                    </Box>;
                })}
            </Box>
            <Box sx={{ flex: 2 }}>
                <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>{ballots.length} different ballots</Typography>
                {ballots.map((b, i) => {
                    const voters = b.groups.reduce((a, g) => a + (s.counts[g] ?? 0), 0);
                    return <Paper key={i} variant='outlined' sx={{ p: 1.5, mt: 1, borderColor: b.races.length ? undefined : 'error.main' }}>
                        <Typography variant='body2' sx={{ fontWeight: 600 }}>
                            {b.groups.map(label).join(', ')} · {voters} of {total(s)} voters
                        </Typography>
                        {b.races.length === 0
                            ? <Typography variant='body2' color='error'>No races</Typography>
                            : <ol style={{ margin: '4px 0 0', paddingLeft: 20 }}>{b.races.map(r => <li key={r.race_id}><Typography variant='body2'>{r.title}</Typography></li>)}</ol>}
                    </Paper>;
                })}
            </Box>
        </Stack>

        <EditGroupsDialog open={editing} onClose={() => setEditing(false)} s={s} actions={actions} />
    </Box>;
}

function EditGroupsDialog({ open, onClose, s, actions }: { open: boolean; onClose: () => void; s: ProtoState; actions: ProtoActions }) {
    return <Dialog open={open} onClose={onClose}>
        <DialogTitle>Voter groups</DialogTitle>
        <DialogContent>
            <List dense>
                {s.groups.map(g => {
                    const inUse = (s.counts[g] ?? 0) > 0;
                    return <Box key={g}>
                        <Stack direction='row' sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                            <ListItemText primary={g} secondary={`${s.counts[g] ?? 0} voters`} />
                            <IconButton aria-label={`Delete ${g}`} disabled={inUse} onClick={() => actions.deleteGroup(g)}><DeleteIcon /></IconButton>
                        </Stack>
                        {/* Same treatment as SwitchSetting's disabledMessage on the Settings page */}
                        {inUse && <FormHelperText sx={{ mt: 0, mb: 1, fontStyle: 'italic', textAlign: 'right' }}>
                            Can&apos;t delete a group that has voters
                        </FormHelperText>}
                    </Box>;
                })}
            </List>
            <GroupAdder actions={actions} />
        </DialogContent>
        <DialogActions><Button onClick={onClose}>Done</Button></DialogActions>
    </Dialog>;
}

// ---------- Variant D: A's grid + C's dialog, ballot-style warnings ----------

function VariantD({ s, actions }: { s: ProtoState; actions: ProtoActions }) {
    const [editing, setEditing] = useState(false);
    const cols = allColumns(s);
    const emptyCols = cols.filter(g => racesFor(s, g).length === 0);
    const emptyRows = s.races.filter(r => r.precincts !== undefined && r.precincts.length === 0);
    // Same yellow as skipped-rank columns on ranked ballots (GenericBallotGrid).
    const warn = 'brand.warningColumn';
    const warnings = [
        ...emptyRows.map(r => `No voter group can see "${r.title}". Tick at least one group for this race.`),
        ...emptyCols.map(g => `${label(g)} voters would see no races. Tick at least one race for this group.`),
    ];
    if (!s.enabled) return null;
    return <Box sx={{ mt: 1 }}>
        {/* fit-content + the alerts' width:0/minWidth:100% keeps long warnings from widening the section */}
        <Box sx={{ width: 'fit-content', maxWidth: '100%' }}>
        <Box sx={{ overflowX: 'auto' }}>
            <Table size='small' sx={{ '& td, & th': { px: 1 } }}>
                <TableHead>
                    <TableRow>
                        <TableCell sx={{ verticalAlign: 'bottom' }}>
                            <Button size='small' variant='outlined' startIcon={<EditIcon />} onClick={() => setEditing(true)}>
                                {s.groups.length ? 'Edit groups' : 'Add groups'}
                            </Button>
                        </TableCell>
                        {cols.map(g => <TableCell key={g} align='center' sx={{ bgcolor: emptyCols.includes(g) ? warn : undefined }}>
                            <Box sx={{ fontWeight: 600, fontStyle: g === NO_GROUP ? 'italic' : undefined }}>{label(g)}</Box>
                            <Box sx={{ fontSize: 12, color: 'text.secondary' }}>{s.counts[g] ?? 0} voters</Box>
                        </TableCell>)}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {s.races.map(r => {
                        const rowWarn = emptyRows.includes(r);
                        return <TableRow key={r.race_id} sx={{ bgcolor: rowWarn ? warn : undefined }}
                            aria-label={rowWarn ? `Warning: no group can see ${r.title}` : undefined}>
                            <TableCell>{r.title}</TableCell>
                            {cols.map(g => <TableCell key={g} align='center' sx={{ bgcolor: emptyCols.includes(g) ? warn : undefined }}>
                                <Checkbox checked={sees(r, g)} onChange={e => actions.setCell(r.race_id, g, e.target.checked)}
                                    slotProps={{ input: { 'aria-label': `${r.title} / ${label(g)}` } }} />
                            </TableCell>)}
                        </TableRow>;
                    })}
                </TableBody>
            </Table>
        </Box>
        {warnings.map((m, i) => <Alert key={i} severity='warning' sx={{ mt: 1, padding: '.2cm', width: 0, minWidth: '100%', boxSizing: 'border-box' }}>
            <Typography>{m}</Typography>
        </Alert>)}
        </Box>
        <EditGroupsDialog open={editing} onClose={() => setEditing(false)} s={s} actions={actions} />
    </Box>;
}

// ---------- host ----------

export default function VoterGroupsPrototype() {
    const [s, actions] = useProtoState();
    const variant = usePrototypeVariant(VARIANTS);
    const { election } = useElection();
    const { t } = useSubstitutedTranslation(election.settings.term_type);
    const isD = variant.key === 'D';
    return <Box sx={{ mt: 3, p: 2, border: '2px dashed', borderColor: 'warning.main', borderRadius: 1 }}>
        <Typography variant='caption' color='warning.main'>PROTOTYPE {variant.key}: {variant.name} (changes are not saved)</Typography>
        {!isD && <Typography variant='h6'>Voter Groups</Typography>}
        <SwitchSetting label={isD ? t('election_settings.voter_groups') : 'Show different races to different groups of voters'} toggled={s.enabled} onToggle={actions.setEnabled} />
        {election.state !== 'draft' && s.enabled &&
            <Alert severity='info' sx={{ mt: 1 }}>Races are locked once the election leaves draft (prototype keeps them editable).</Alert>}
        {!s.enabled && !isD && <Typography variant='body2' color='text.secondary'>Off: every voter sees every race. Your groups and race choices are kept if you turn this back on.</Typography>}
        {isD && <VariantD s={s} actions={actions} />}
        {variant.key === 'A' && <VariantA s={s} actions={actions} />}
        {variant.key === 'B' && <VariantB s={s} actions={actions} />}
        {variant.key === 'C' && <VariantC s={s} actions={actions} />}
        <StateDump s={s} />
        <PrototypeSwitcher variants={VARIANTS} />
    </Box>;
}
