import { PageBootLoader } from "@shared/components/page-loader/page-boot";
import { Button } from "@shared/core/button/Button";
import cn from "classnames";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth";
import {
  useCreateBillingCheckoutMutation,
  useGetMyBillingQuery,
  useListBillingPlansQuery,
  useRequestBillingUpgradeMutation,
} from "../api/billing-api";
import "./plan-page.css";

function formatLimit(value: number | null) {
  if (value == null) return "без ограничений";
  return String(value);
}

function formatPrice(value: number | null) {
  if (value == null || value <= 0) return "бесплатно";
  return `${value.toLocaleString("ru-RU")} ₽`;
}

export function PlanPage() {
  const { accessToken } = useAuth();
  const [searchParams] = useSearchParams();
  const paidReturn = searchParams.get("paid") === "1";
  const plansQuery = useListBillingPlansQuery(undefined, { skip: !accessToken });
  const meQuery = useGetMyBillingQuery(undefined, { skip: !accessToken });
  const [createCheckout, checkoutState] = useCreateBillingCheckoutMutation();
  const [requestUpgrade, requestState] = useRequestBillingUpgradeMutation();
  const [notice, setNotice] = useState<string | null>(
    paidReturn
      ? "Если оплата прошла, тариф обновится в течение минуты. Обновите страницу."
      : null,
  );
  const [error, setError] = useState<string | null>(null);

  if (!accessToken) {
    return (
      <div className="plan-page">
        <p className="plan-page__hint">Нужно войти, чтобы увидеть тариф.</p>
      </div>
    );
  }

  if (plansQuery.isLoading || meQuery.isLoading) {
    return <PageBootLoader label="Загрузка тарифа…" />;
  }

  if (plansQuery.isError || meQuery.isError || !meQuery.data) {
    return (
      <div className="plan-page">
        <p className="plan-page__hint">Не удалось загрузить тариф.</p>
      </div>
    );
  }

  const currentName = meQuery.data.plan?.name ?? "free";
  const checkoutEnabled = meQuery.data.checkoutEnabled;
  const plans = plansQuery.data ?? [];
  const actionBusy = checkoutState.isLoading || requestState.isLoading;

  const handlePay = async (planName: string) => {
    setError(null);
    setNotice(null);
    try {
      const result = await createCheckout({ planName }).unwrap();
      window.location.assign(result.confirmationUrl);
    } catch {
      setError("Не удалось открыть оплату. Проверьте ключи ЮKassa или попробуйте позже.");
    }
  };

  const handleRequest = async (planName: string) => {
    setError(null);
    setNotice(null);
    try {
      const result = await requestUpgrade({ planName }).unwrap();
      setNotice(result.message);
    } catch {
      setError("Не удалось отправить запрос. Напишите на sergey@lunyak.ru.");
    }
  };

  return (
    <div className="plan-page">
      <header className="plan-page__header">
        <p className="plan-page__eyebrow">Аккаунт</p>
        <h1>Тариф</h1>
        <p className="plan-page__lead">
          Сейчас: {meQuery.data.plan?.title ?? "Бесплатный"}. Проектов:{" "}
          {meQuery.data.projectsUsed}
          {meQuery.data.plan?.maxProjects != null
            ? ` из ${meQuery.data.plan.maxProjects}`
            : ""}
          .{" "}
          {checkoutEnabled
            ? "Оплата разово через ЮKassa — после платежа тариф открывается автоматически."
            : "Касса ещё не подключена. Можно отправить запрос на тариф."}
        </p>
      </header>

      <ul className="plan-page__list">
        {plans.map((plan) => {
          const isCurrent = plan.name === currentName;
          const isPaidPlan = plan.name === "standard" || plan.name === "premium";
          const cardClassName = cn(
            "plan-page__card",
            isCurrent && "plan-page__card--current",
          );
          return (
            <li key={plan.id} className={cardClassName}>
              <h2>{plan.title}</h2>
              <p className="plan-page__price">{formatPrice(plan.priceRub)}</p>
              <p>Проекты: {formatLimit(plan.maxProjects)}</p>
              <p>
                Участники в проекте:{" "}
                {formatLimit(plan.maxCollaboratorsPerProject)}
              </p>
              {isCurrent ? (
                <p className="plan-page__current">Текущий тариф</p>
              ) : isPaidPlan ? (
                <Button
                  variant="secondary"
                  disabled={actionBusy}
                  onClick={() => {
                    if (checkoutEnabled) {
                      void handlePay(plan.name);
                      return;
                    }
                    void handleRequest(plan.name);
                  }}
                >
                  {checkoutEnabled
                    ? `Оплатить ${formatPrice(plan.priceRub)}`
                    : "Запросить"}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>

      {notice ? <p className="plan-page__notice">{notice}</p> : null}
      {error ? <p className="plan-page__error">{error}</p> : null}
    </div>
  );
}
