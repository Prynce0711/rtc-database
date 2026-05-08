// LOGIC for statistics of cases in table

const originalRaffleDate = new Date();
const updatedRaffleDate = new Date();
const dateFiled = new Date();
const branch: string | null = null;
const currentDate = new Date();

const isCaseNewFiled = (currentDate <= originalRaffleDate && !branch);

const isCasePending = (currentDate > originalRaffleDate && !branch) || (currentDate <= updatedRaffleDate && !branch);

const isCaseDisposed = (currentDate > originalRaffleDate && branch) || (currentDate > updatedRaffleDate && branch);
