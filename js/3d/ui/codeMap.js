// Illustrative C# shown next to the twin, and which lines each LGV state "executes".
// Not production code of any company: it mirrors the logic of js/3d/twin/fleet.js.

export const CODE_LINES = [
    '// Illustrative code — mirrors the simulation running in this page',
    'public sealed class LgvController',
    '{',
    '    private readonly ITrafficManager traffic;',
    '    private readonly IMissionManager missions;',
    '    private readonly IErpClient erp;',
    '    public async Task StepAsync(Lgv lgv, CancellationToken ct)',
    '    {',
    '        switch (lgv.State)',
    '        {',
    '            case LgvState.Idle:',
    '                if (missions.Next(lgv) is { } mission) lgv.Assign(mission);',
    '                break;',
    '',
    '            case LgvState.GoToPick:',
    '            case LgvState.GoToDrop:',
    '            case LgvState.GoToCharge:',
    '            case LgvState.GoToPark:',
    '                var zone = lgv.Route.NextZone(lookAhead: 4.0);',
    '                if (!traffic.TryReserve(zone, lgv.Id))',
    '                {',
    '                    lgv.StopBefore(zone, margin: 1.0);',
    '                    lgv.State = LgvState.WaitZone;',
    '                    return;',
    '                }',
    '                lgv.Follow(lgv.Route, maxSpeed: lgv.OnCurve ? 0.6 : 1.5);',
    '                traffic.ReleaseBehind(lgv, clearance: 2.2);',
    '                break;',
    '',
    '            case LgvState.WaitZone:',
    '                if (traffic.TryReserve(lgv.WaitingFor, lgv.Id)) lgv.State = lgv.PreviousState;',
    '                break;',
    '',
    '            case LgvState.Docking:',
    '            case LgvState.DockingDrop:',
    '                await lgv.RotateToAsync(lgv.Station.Heading, ct);',
    '                await lgv.DriveAsync(lgv.Station.Dock, speed: 0.3, ct);',
    '                break;',
    '',
    '            case LgvState.Lifting:',
    '                await lgv.Forks.LiftAsync(Height.Travel, ct);',
    '                break;',
    '',
    '            case LgvState.Lowering:',
    '                await lgv.Forks.LowerAsync(ct);',
    '                await erp.ConfirmAsync(lgv.Mission.Id, Status.Delivered);',
    '                break;',
    '',
    '            case LgvState.Undocking:',
    '            case LgvState.UndockingDrop:',
    '                await lgv.DriveAsync(lgv.Station.Approach, speed: -0.3, ct);',
    '                break;',
    '',
    '            case LgvState.Charging:',
    '                if (lgv.Battery >= 0.95) lgv.State = LgvState.Idle;',
    '                break;',
    '            case LgvState.Alarm: lgv.EmergencyStop(); break;',
    '        }',
    '    }',
    '}',
];

/** 1-based inclusive range from the line containing `from` to the next line containing `to` (default: same block's `break`). */
function range(from, to = 'break') {
    const a = CODE_LINES.findIndex((l) => l.includes(from));
    if (a < 0) throw new Error(`codeMap: "${from}" not found`);
    let b = a;
    while (b < CODE_LINES.length - 1 && !CODE_LINES[b].includes(to)) b++;
    return [a + 1, b + 1];
}

const travel = [range('lgv.Route.NextZone')[0], range('traffic.ReleaseBehind')[1]];

export const STATE_LINES = {
    Idle: range('case LgvState.Idle:'),
    GoToPick: travel,
    GoToDrop: travel,
    GoToCharge: travel,
    GoToPark: travel,
    WaitZone: range('case LgvState.WaitZone:'),
    Docking: range('lgv.RotateToAsync', 'lgv.DriveAsync(lgv.Station.Dock'),
    DockingDrop: range('lgv.RotateToAsync', 'lgv.DriveAsync(lgv.Station.Dock'),
    Lifting: range('lgv.Forks.LiftAsync', 'lgv.Forks.LiftAsync'),
    Lowering: range('lgv.Forks.LowerAsync', 'erp.ConfirmAsync'),
    Undocking: range('lgv.Station.Approach', 'lgv.Station.Approach'),
    UndockingDrop: range('lgv.Station.Approach', 'lgv.Station.Approach'),
    Charging: range('if (lgv.Battery >= 0.95)', 'if (lgv.Battery >= 0.95)'),
    Alarm: range('case LgvState.Alarm:', 'case LgvState.Alarm:'),
};
