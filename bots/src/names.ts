// Fictional, NYC-plausible names for AI residents. No real people or real businesses.
export const FIRST = ['Maria', 'James', 'Wei', 'Aisha', 'Carlos', 'Priya', 'Dmitri', 'Fatima', 'Kevin', 'Sofia', 'Tomas', 'Grace', 'Omar', 'Lucia', 'Andre', 'Mei', 'Isaac', 'Nadia', 'Rafael', 'Yuki', 'Daniel', 'Amara', 'Luis', 'Hannah', 'Kofi', 'Elena', 'Samuel', 'Leila', 'Marco', 'Zoe', 'Victor', 'Ines', 'Jamal', 'Rosa', 'Noah', 'Mina'];
export const LAST = ['Alvarez', 'Chen', 'Okafor', 'Rossi', 'Kim', 'Patel', 'Goldberg', 'Nguyen', 'Rivera', 'O’Brien', 'Haddad', 'Kowalski', 'Santos', 'Park', 'Murphy', 'Lopez', 'Ibrahim', 'Cohen', 'Greene', 'Novak', 'Morales', 'Tanaka', 'Abebe', 'Russo', 'Singh', 'Fischer', 'Diaz', 'Volkov', 'Mendez', 'Walsh', 'Ortiz', 'Byrne', 'Dang', 'Mensah', 'Weiss', 'Castillo'];

const CAFE = ['{last} Coffee', '{street} Espresso', 'Little {last}', '{first}’s Café', 'Cup of {street}', '{street} Bean Co.', 'Morning {last}', '{first} & Crumb'];
const BARBER = ['{first}’s Cuts', '{street} Barbers', 'Clean Fade by {first}', '{last} Barbershop', 'Sharp {street}', '{first}’s Chair', 'The {last} Shop', 'Blade & {last}'];

/** "St Marks Pl, 2nd–3rd Ave" → "St Marks" */
export function streetToken(block: string): string {
  return block.split(',')[0].replace(/\s+(Pl|St|Ave)$/, '').trim();
}

export function businessName(niche: string, person: string, block: string, pickIndex: number): string {
  const [first, ...rest] = person.split(' ');
  const last = rest.join(' ') || first;
  const pool = niche === 'barbershop' ? BARBER : CAFE;
  return pool[pickIndex % pool.length].replace('{first}', first).replace('{last}', last).replace('{street}', streetToken(block));
}

export const OFFICIAL_TITLES = { inspector: 'Inspector', tax_auditor: 'Auditor' } as const;
