import {
  AnchorButton,
  Button,
  ButtonGroup,
  Card,
  Checkbox,
  Classes,
  Icon,
  Tooltip,
} from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import { useHotkeys, type HotkeyItem } from "@mantine/hooks";
import type { Tab } from "@sourceacademy/common-tabs";
import classNames from "classnames";
import i18n from "i18next";
import { useEffect, useState } from "react";

import { Trans, initReactI18next, useTranslation } from "react-i18next";
import DataVisualizer from "./dataVisualizer";
import type { Step } from "./dataVisualizerTypes";
import type { Config } from "@sourceacademy/common-data-display";
import React from "react";

type Props = {
  workspaceLocation: string;
  config: Config;
};
export function ItalicLink({ href, children }: { href: string; children?: React.ReactNode }) {
  return (
    <a href={href} rel="noopener noreferrer" target="_blank">
      <i>{children}</i>
    </a>
  );
}

const translations = {
  defaultText: "The data visualizer helps you to visualize data structures.",
  instructions:
    "It is activated by calling the function <0/>, where <1/> would be the <2/> data structure that you want to visualize and <3/> is the number of structures.",
  reference: "The data visualizer uses box-and-pointer diagrams, as introduced in <0 />.",
  label: "Data Visualizer",
  previous: "Previous",
  next: "Next",
  call: "Call",
  structure: "Structure",
  views: {
    original: "Original View",
    binaryTree: "Binary Tree View",
    generalTree: "General Tree View",
  },
};
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: translations },
  },
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

function SideContentDataVisualizer({ workspaceLocation, config }: Props) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const { t } = useTranslation();

  useEffect(() => {
    DataVisualizer.init(steps => {
      setSteps(steps);
      setCurrentStep(0);
    });
  }, [workspaceLocation]);

  const onPrevButtonClick = () => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  };

  const onNextButtonClick = () => {
    setCurrentStep(prev => Math.min(steps.length - 1, prev + 1));
  };

  const onViewModeClick = (prevStep: number) => {
    setCurrentStep(prevStep);
  };

  const step: Step | undefined = steps[currentStep];
  const firstStep = currentStep === 0;
  const finalStep = !steps || currentStep === steps.length - 1;

  const hotkeyBindings: HotkeyItem[] = [
    ["ArrowLeft", onPrevButtonClick],
    ["ArrowRight", onNextButtonClick],
  ];
  useHotkeys(hotkeyBindings);

  return (
    <div className={classNames("sa-data-visualizer", Classes.DARK)}>
      {steps.length > 1 ? (
        <div
          style={{
            position: "relative",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <Button
            style={{
              position: "absolute",
              left: 0,
            }}
            size="large"
            variant="outlined"
            icon={IconNames.ARROW_LEFT}
            onClick={onPrevButtonClick}
            disabled={firstStep}
          >
            {t("previous")}
          </Button>
          <h3 className={Classes.TEXT_LARGE}>
            {t("call")} {currentStep + 1}/{steps.length}
          </h3>
          <Button
            style={{
              position: "absolute",
              right: 0,
            }}
            size="large"
            variant="outlined"
            icon={IconNames.ARROW_RIGHT}
            onClick={onNextButtonClick}
            disabled={finalStep}
          >
            {t("next")}
          </Button>
        </div>
      ) : null}
      {steps.length > 0 ? (
        <div
          key={step.length} // To ensure the style refreshes if the step length changes
          style={{
            display: "flex",
            flexDirection: "row",
            overflowX: "auto",
          }}
        >
          {step?.map((elem, i) => (
            <div key={i} style={{ margin: step.length > 1 ? 0 : "0 auto" }}>
              {" "}
              {/* To center element when there is only one */}
              <Card style={{ background: "#1a2530", padding: 10 }}>
                {step.length > 1 && (
                  <h5
                    className={classNames(Classes.HEADING, Classes.MONOSPACE_TEXT)}
                    style={{ marginTop: 0, marginBottom: 20, whiteSpace: "nowrap" }}
                  >
                    {t("structure")} {i + 1}
                  </h5>
                )}
                {elem}
              </Card>
            </div>
          ))}
        </div>
      ) : (
        <DataVisualizerDefaultText config={config} />
      )}
      {steps.length > 0 && (
        <>
          <ButtonGroup>
            <Tooltip content={t("views.original")} position="top">
              <AnchorButton
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onMouseUp={() => {
                  DataVisualizer.setMode("normal");
                  DataVisualizer.redraw();
                  onViewModeClick(currentStep);
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon icon="grid-view" />
                  <Checkbox
                    checked={DataVisualizer.getNormalMode()}
                    style={{ marginTop: 7 }}
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                </div>
              </AnchorButton>
            </Tooltip>
          </ButtonGroup>

          <Tooltip content={t("views.binaryTree")} position="top">
            <AnchorButton
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                marginLeft: 10,
              }}
              onMouseUp={() => {
                DataVisualizer.setMode("binTree");
                DataVisualizer.redraw();
                onViewModeClick(currentStep);
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon icon="one-to-many" style={{ transform: "rotate(90deg)", marginLeft: 6 }} />
                <Checkbox
                  checked={DataVisualizer.getBinTreeMode()}
                  style={{ marginTop: 7 }}
                  tabIndex={-1}
                  aria-hidden="true"
                />
              </div>
            </AnchorButton>
          </Tooltip>
          <Tooltip content={t("views.generalTree")} position="top">
            <AnchorButton
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                marginLeft: 10,
              }}
              onMouseUp={() => {
                DataVisualizer.setMode("tree");
                DataVisualizer.redraw();
                onViewModeClick(currentStep);
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon icon="diagram-tree" />
                <Checkbox
                  checked={DataVisualizer.getTreeMode()}
                  style={{ marginTop: 7 }}
                  tabIndex={-1}
                  aria-hidden="true"
                />
              </div>
            </AnchorButton>
          </Tooltip>
        </>
      )}
    </div>
  );
}

const makeDataVisualizerTabFrom = (location: string, config: Config): Tab => ({
  label: i18n.t("label"),
  iconName: IconNames.EYE_OPEN,
  body: <SideContentDataVisualizer workspaceLocation={location} config={config} />,
  id: "dataviz",
});

function parseFunctionCallText(functionCallText: string) {
  const parts = functionCallText.split(/(x(?:\d+|n))/g);
  const parsedParts = parts.map((part, index) => {
    if (index % 2 === 1) {
      return (
        <React.Fragment key={index}>
          x<sub>{part.slice(1)}</sub>
        </React.Fragment>
      );
    }
    return part;
  });
  return <>{...parsedParts}</>;
}

function DataVisualizerDefaultText({ config }: { config: Config }) {
  const { t } = useTranslation();
  return (
    <p id="data-visualizer-default-text" className={Classes.RUNNING_TEXT}>
      {t("defaultText")}
      <br />
      <br />
      <Trans
        i18nKey={"instructions"}
        components={[
          <code>{parseFunctionCallText(config.functionCallText)}</code>,

          <code>
            x<sub>k</sub>
          </code>,

          <code>
            k<sup>th</sup>
          </code>,

          <code>n</code>,
        ]}
      />
      <br />
      <br />
      <Trans
        i18nKey={"reference"}
        components={[
          <ItalicLink href={config.sicpTextbookUrl}>{config.sicpTextbookName}</ItalicLink>,
        ]}
      />
    </p>
  );
}

export default makeDataVisualizerTabFrom;
