import unittest
from pathlib import Path

try:
    import yaml
except ImportError:  # PyYAML is a dev-only dependency; the Lambda does not need it
    yaml = None

TEMPLATE = Path(__file__).resolve().parents[2] / "src" / "aws" / "template.yaml"


def load_template():
    class Loader(yaml.SafeLoader):
        pass

    def tag(loader, suffix, node):
        if isinstance(node, yaml.ScalarNode):
            value = loader.construct_scalar(node)
        elif isinstance(node, yaml.SequenceNode):
            value = loader.construct_sequence(node, deep=True)
        else:
            value = loader.construct_mapping(node, deep=True)
        return {suffix: value}

    Loader.add_multi_constructor("!", tag)
    return yaml.load(TEMPLATE.read_text(encoding="utf-8"), Loader=Loader)


@unittest.skipIf(yaml is None, "PyYAML not installed")
class BedrockOptionalTests(unittest.TestCase):
    def setUp(self):
        self.template = load_template()

    def test_bedrock_is_off_by_default(self):
        for name in ("BedrockRegion", "BedrockModelId", "BedrockInvokeResourceArns"):
            self.assertEqual(self.template["Parameters"][name]["Default"], "", name)
        self.assertEqual(
            self.template["Conditions"]["BedrockEnabled"],
            {"Not": [{"Equals": [{"Ref": "BedrockModelId"}, ""]}]},
        )

    def test_worker_gets_bedrock_permission_only_when_enabled(self):
        statements = self.template["Resources"]["WorkerRole"]["Properties"]["Policies"][0]["PolicyDocument"]["Statement"]
        plain = [item for item in statements if "Action" in item]
        self.assertFalse(any(item["Action"] == "bedrock:InvokeModel" for item in plain))
        guarded = [item["If"] for item in statements if "If" in item and item["If"][0] == "BedrockEnabled"]
        self.assertEqual(len(guarded), 1)
        self.assertEqual(guarded[0][1]["Action"], "bedrock:InvokeModel")
        self.assertEqual(guarded[0][2], {"Ref": "AWS::NoValue"})

    def test_partial_bedrock_settings_are_rejected_and_outputs_are_conditional(self):
        self.assertIn("BedrockParametersComeTogether", self.template["Rules"])
        for name in ("BedrockRegion", "BedrockModelId"):
            self.assertEqual(self.template["Outputs"][name]["Condition"], "BedrockEnabled")

    def test_default_ai_provider_reaches_the_api_function(self):
        variables = self.template["Globals"]["Function"]["Environment"]["Variables"]
        self.assertEqual(variables["DEFAULT_AI_PROVIDER"]["If"][0], "BedrockEnabled")
        worker = self.template["Resources"]["AiWorkerFunction"]["Properties"]["Environment"]["Variables"]
        self.assertNotIn("DEFAULT_AI_PROVIDER", worker)


if __name__ == "__main__":
    unittest.main()
