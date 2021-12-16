// Copyright (c) 2021, Qualcomm Innovation Center, Inc. All rights reserved.
// SPDX-License-Identifier: BSD-3-Clause
#pragma once

#include "gui.hpp"

///
/// @brief Class implementing imgui functionality that is not in any way related to platform or rendering api.
/// Ie imgui:: setup calls
/// @ingroup GUI
//
class GuiImguiBase : public Gui
{
public:
    bool Initialize(uintptr_t windowHandle) override;
    void Update() override;

    bool WantCaptureMouse() const override;
    bool WantCaptureKeyboard() const override;
};