export type LocalObservationInput = {
  cloudCover: number | null | undefined;
  visibilityKm: number | null | undefined;
  hasPassPrediction: boolean;
  passDistanceKm: number | null | undefined;
};

export function getWeatherDescription(weatherCode: number | null | undefined) {
  if (weatherCode === null || weatherCode === undefined) return "condições em atualização";
  if (weatherCode === 0 || weatherCode === 1) return "céu predominantemente aberto";
  if (weatherCode === 2 || weatherCode === 3) return "nuvens em variação";
  if (weatherCode >= 45 && weatherCode <= 48) return "neblina ou névoa";
  if (weatherCode >= 51 && weatherCode <= 67) return "precipitação leve ou moderada";
  if (weatherCode >= 71 && weatherCode <= 77) return "neve ou granizo";
  if (weatherCode >= 80 && weatherCode <= 82) return "pancadas de chuva";
  if (weatherCode >= 95) return "atividade elétrica";
  return "condição variável";
}

export function getObservationReadiness({ cloudCover, visibilityKm }: LocalObservationInput) {
  if (cloudCover === null || cloudCover === undefined || visibilityKm === null || visibilityKm === undefined) {
    return { label: "céu em leitura", tone: "neutral" as const };
  }
  if (cloudCover < 25 && visibilityKm >= 8) return { label: "janela favorável", tone: "good" as const };
  if (cloudCover >= 70 || visibilityKm < 3) return { label: "janela limitada", tone: "limited" as const };
  return { label: "janela variável", tone: "neutral" as const };
}

export function getObservationGuidance({ cloudCover, visibilityKm, hasPassPrediction, passDistanceKm }: LocalObservationInput) {
  if (!hasPassPrediction) return "A rota da ISS está sendo comparada ao seu horizonte; mantenha esta página aberta por alguns instantes.";
  if (cloudCover !== null && cloudCover !== undefined && cloudCover >= 70) return "A aproximação pode ocorrer, mas a cobertura de nuvens tende a dificultar a observação a olho nu.";
  if (visibilityKm !== null && visibilityKm !== undefined && visibilityKm < 3) return "A visibilidade local está reduzida. Procure um ponto aberto e verifique novamente mais perto da passagem.";
  if (passDistanceKm !== null && passDistanceKm !== undefined && passDistanceKm <= 500) return "A aproximação estimada é promissora. Poucos minutos antes, procure um horizonte aberto e reduza fontes de luz próximas.";
  return "A passagem estimada fica mais distante do seu horizonte. Continue acompanhando: a previsão será atualizada com a telemetria.";
}
