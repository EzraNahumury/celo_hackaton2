const K_FACTOR = 32;

export function calculateElo(
  winnerRating: number,
  loserRating: number,
  isDraw: boolean = false
): { newWinnerRating: number; newLoserRating: number } {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  const expectedLoser = 1 - expectedWinner;

  let newWinnerRating: number;
  let newLoserRating: number;

  if (isDraw) {
    newWinnerRating = Math.round(winnerRating + K_FACTOR * (0.5 - expectedWinner));
    newLoserRating = Math.round(loserRating + K_FACTOR * (0.5 - expectedLoser));
  } else {
    newWinnerRating = Math.round(winnerRating + K_FACTOR * (1 - expectedWinner));
    newLoserRating = Math.round(loserRating + K_FACTOR * (0 - expectedLoser));
  }

  return {
    newWinnerRating: Math.max(100, newWinnerRating),
    newLoserRating: Math.max(100, newLoserRating),
  };
}
