import { isFavorablePass } from "./passAlerts";

type TodayObservationInput = {
  hasLocation: boolean;
  hasPassPrediction: boolean;
  passDistanceKm?: number | null;
  cloudCover?: number | null;
  visibilityKm?: number | null;
};

export type TodayObservationState = {
  tone: "ready" | "variable" | "limited" | "waiting";
  label: string;
  headline: string;
  detail: string;
};

export function getTodayObservationState({ hasLocation, hasPassPrediction, passDistanceKm, cloudCover, visibilityKm }: TodayObservationInput): TodayObservationState {
  if (!hasLocation) {
    return {
      tone: "waiting",
      label: "horizonte necessário",
      headline: "Defina sua localização para montar o plano de hoje.",
      detail: "A posição é usada apenas nesta consulta para calcular a passagem da ISS e consultar o céu local.",
    };
  }

  if (!hasPassPrediction || passDistanceKm === null || passDistanceKm === undefined) {
    return {
      tone: "waiting",
      label: "calculando rota",
      headline: "A rota da próxima passagem está sendo calculada.",
      detail: "Assim que a previsão responder, esta aba organiza o melhor momento e a leitura do seu céu.",
    };
  }

  if (!isFavorablePass(passDistanceKm)) {
    return {
      tone: "limited",
      label: "passagem distante",
      headline: "Há uma passagem no período, mas ela não é uma aproximação favorável.",
      detail: "Você ainda pode acompanhar a ISS no globo; volte a consultar mais tarde para uma janela mais promissora.",
    };
  }

  if ((cloudCover !== null && cloudCover !== undefined && cloudCover >= 70) || (visibilityKm !== null && visibilityKm !== undefined && visibilityKm < 3)) {
    return {
      tone: "limited",
      label: "céu limitado",
      headline: "A aproximação existe, mas o céu pode dificultar a observação.",
      detail: "Priorize um horizonte aberto e confira novamente as nuvens antes do horário previsto.",
    };
  }

  if ((cloudCover === null || cloudCover === undefined || cloudCover < 35) && (visibilityKm === null || visibilityKm === undefined || visibilityKm >= 8)) {
    return {
      tone: "ready",
      label: "boa janela",
      headline: "Há uma janela promissora para procurar a ISS hoje.",
      detail: "Separe alguns minutos antes do horário previsto e escolha um local com visão livre do céu.",
    };
  }

  return {
    tone: "variable",
    label: "janela variável",
    headline: "A passagem é favorável, com condições locais que pedem atenção.",
    detail: "Observe as nuvens próximas ao horário previsto e mantenha uma área ampla do céu no campo de visão.",
  };
}
